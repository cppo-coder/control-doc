<?php

namespace App\Services;

use App\Models\Document;
use App\Models\OccupationalExam;
use App\Models\WorkerDocument;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class DocumentAnalysisService
{
    protected const ANALYSIS_CACHE_VERSION = '2026-03-17-altitud-geografica-v2';

    protected ?array $lastAiUsage = null;

    public function __construct(
        protected ?AiLoadBalancerService $aiLoadBalancer = null,
    ) {
        $this->aiLoadBalancer ??= app(AiLoadBalancerService::class);
    }

    /**
     * Analiza un documento ya almacenado en Google Drive.
     */
    public function analyze(Document $document): array
    {
        $document->loadMissing('category.project');

        $categoryName = strtolower($document->category->name);
        $isMedical = str_contains($categoryName, 'examen');

        if (! $isMedical) {
            return [
                'success' => false,
                'error' => 'Este documento no pertenece a una categoría médica para análisis directo.',
            ];
        }

        $successStatuses = ['clean', 'alert', 'critical', 'rejected', 'contrato_ok', 'contrato_alert'];
        if (in_array($document->analysis_status, $successStatuses, true) && $document->analysis_data) {
            return [
                'success' => true,
                'status' => $document->analysis_status,
                'data' => $document->analysis_data,
            ];
        }

        try {
            $fileContent = $this->getDocumentBinary($document);
        } catch (\Exception $e) {
            Log::error('Error descargando PDF de Drive: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'No se pudo descargar el archivo desde Google Drive.',
            ];
        }

        $result = $this->analyzePdfContent($fileContent, $document->name, $document->category?->name);

        if (! ($result['success'] ?? false)) {
            $document->update([
                'analysis_status' => 'error',
                'analysis_data' => ['error' => $result['error'] ?? 'No fue posible analizar el PDF.'],
                'analyzed_at' => now(),
            ]);

            return $result;
        }

        return $this->applyMedicalAnalysis($document, $result['data']);
    }

    /**
     * Analiza un PDF temporal antes de guardarlo en Drive o en la BD.
     */
    public function analyzeUploadedPdf(string $pdfPath, ?string $displayName = null, ?string $categoryName = null): array
    {
        $fileContent = @file_get_contents($pdfPath);

        if ($fileContent === false) {
            return [
                'success' => false,
                'error' => 'No fue posible leer el PDF temporal para su análisis.',
            ];
        }

        return $this->analyzePdfContent($fileContent, $displayName ?? basename($pdfPath), $categoryName);
    }

    public function analyzeMedicalContent(string $fileContent, ?string $displayName = null, ?string $categoryName = null): array
    {
        return $this->analyzePdfContent($fileContent, $displayName, $categoryName);
    }

    public function extractTextForNotebook(string $fileContent, ?string $displayName = null): array
    {
        return $this->extractTextFromPdf($fileContent, $displayName);
    }

    public function analyzeNotebookExtractedText(Document $document, string $text, ?string $displayName = null, ?string $supplementalText = null): array
    {
        $mergedText = trim(collect([
            filled($supplementalText) ? "TEXTO PDF EXTRAIDO DIRECTAMENTE:\n{$supplementalText}" : null,
            filled($text) ? "CONTEXTO NOTEBOOKLM:\n{$text}" : null,
        ])->filter()->implode("\n\n"));

        if (blank($mergedText)) {
            return [
                'success' => false,
                'error' => 'NotebookLM no devolvió texto utilizable para analizar.',
            ];
        }

        try {
            $analysisData = $this->analyzeTextWithBalancer(
                $mergedText,
                $this->buildMedicalAnalysisPrompt($mergedText, $document->category?->name)
            );
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'error' => 'Sin conexión con la IA. Verifica tu acceso a internet e inténtalo de nuevo.',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $this->normalizeAnalysisError($e),
            ];
        }

        if (! is_array($analysisData)) {
            return [
                'success' => false,
                'error' => 'La IA devolvió una respuesta inválida durante el análisis del documento.',
            ];
        }

        $analysisData = $this->enforceMedicalRules($analysisData, $mergedText);
        $analysisData = $this->enforceCategoryRules($analysisData, $document->category?->name);
        $analysisData['_pipeline'] = array_merge($analysisData['_pipeline'] ?? [], [
            'text_source' => 'notebooklm_source',
            'display_name' => $displayName,
            'supplemental_pdf_text' => filled($supplementalText),
        ]);
        $analysisData['_usage'] = $this->buildUsagePayload('notebooklm_source');

        return [
            'success' => true,
            'status' => $this->resolveMedicalStatus($analysisData),
            'data' => $analysisData,
        ];
    }

    public function applyMedicalAnalysis(Document $document, array $analysisData): array
    {
        $analysisStatus = $this->resolveMedicalStatus($analysisData);

        $document->update([
            'analysis_status' => $analysisStatus,
            'analysis_data' => $analysisData,
            'analyzed_at' => now(),
        ]);

        $this->persistMedicalExam($document, $analysisData, $analysisStatus);

        return [
            'success' => true,
            'status' => $analysisStatus,
            'data' => $analysisData,
        ];
    }

    public function normalizeStoredMedicalAnalysis(Document $document, array $analysisData): array
    {
        $contextText = collect([
            $analysisData['resumen'] ?? null,
            data_get($analysisData, 'drogas.detalle'),
            collect(data_get($analysisData, 'otros_hallazgos', []))
                ->map(fn ($finding) => trim(((string) ($finding['titulo'] ?? '')).' '.((string) ($finding['valor'] ?? ''))))
                ->implode(' '),
        ])->filter(fn ($value) => filled($value))->implode("\n");

        $normalized = $this->enforceMedicalRules($analysisData, $contextText);
        $normalized = $this->enforceCategoryRules($normalized, $document->category?->name);

        return $this->applyMedicalAnalysis($document, $normalized);
    }

    /**
     * Analiza un PDF usando extracción nativa y fallback OCR con Gemini.
     */
    public function analyzePdfContent(string $fileContent, ?string $displayName = null, ?string $categoryName = null): array
    {
        try {
            $extraction = $this->extractTextFromPdf($fileContent, $displayName);
        } catch (ConnectionException $e) {
            $errorMsg = 'Sin conexión con la IA. Verifica tu acceso a internet e inténtalo de nuevo.';
            Log::error('[GEMINI] ===== SIN CONEXIÓN CON LA IA ===== '.$e->getMessage());

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        } catch (\Exception $e) {
            $errorMsg = $this->normalizeAnalysisError($e);

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        }

        if (blank($extraction['text'] ?? null)) {
            return [
                'success' => false,
                'error' => 'No fue posible procesar el documento para su análisis.',
            ];
        }

        $text = trim($extraction['text']);
        $contentHash = md5($text);
        $categoryHash = md5((string) str((string) $categoryName)->lower()->ascii()->value());
        $cacheKey = 'doc_analysis_'.self::ANALYSIS_CACHE_VERSION.'_'.$categoryHash.'_'.$contentHash;
        $wasCached = Cache::has($cacheKey);

        try {
            $analysisData = Cache::remember($cacheKey, now()->addDays(30), function () use ($text, $categoryName) {
                return $this->analyzeTextWithBalancer(
                    $text,
                    $this->buildMedicalAnalysisPrompt($text, $categoryName)
                );
            });
        } catch (ConnectionException $e) {
            $errorMsg = 'Sin conexión con la IA. Verifica tu acceso a internet e inténtalo de nuevo.';
            Log::error('[GEMINI] ===== SIN CONEXIÓN CON LA IA ===== '.$e->getMessage());

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        } catch (\Exception $e) {
            $errorMsg = $this->normalizeAnalysisError($e);

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        }

        if (! is_array($analysisData)) {
            return [
                'success' => false,
                'error' => 'La IA devolvió una respuesta inválida durante el análisis del documento.',
            ];
        }

        $analysisData = $this->enforceMedicalRules($analysisData, $text);
        $analysisData = $this->enforceCategoryRules($analysisData, $categoryName);

        $analysisData['_pipeline'] = [
            'text_source' => $extraction['source'],
            'display_name' => $displayName,
        ];
        $analysisData['_usage'] = $this->buildUsagePayload($extraction['source'], $wasCached);

        return [
            'success' => true,
            'status' => $this->resolveMedicalStatus($analysisData),
            'data' => $analysisData,
        ];
    }

    protected function extractTextFromPdf(string $fileContent, ?string $displayName = null): array
    {
        $nativeText = $this->extractTextWithParser($fileContent);

        if (filled($nativeText)) {
            return [
                'text' => $nativeText,
                'source' => 'pdf_text',
            ];
        }

        $ocrText = $this->extractTextWithGeminiOcr($fileContent, $displayName);

        return [
            'text' => $ocrText,
            'source' => filled($ocrText) ? 'ocr_gemini' : 'none',
        ];
    }

    protected function extractTextWithParser(string $fileContent): string
    {
        $tmpPath = sys_get_temp_dir().'/doc_'.md5($fileContent.microtime(true)).'.pdf';
        file_put_contents($tmpPath, $fileContent);

        try {
            $parser = new Parser;
            $pdf = $parser->parseFile($tmpPath);

            return trim($pdf->getText());
        } catch (\Exception $e) {
            Log::warning('PDF parser falló durante la extracción de texto: '.$e->getMessage());

            return '';
        } finally {
            @unlink($tmpPath);
        }
    }

    protected function extractTextWithGeminiOcr(string $fileContent, ?string $displayName = null): string
    {
        $ocrText = $this->aiLoadBalancer->extractPdfTextWithGemini($fileContent, $displayName);
        $this->lastAiUsage = $this->aiLoadBalancer->lastUsage();

        return $ocrText;
    }

    protected function analyzeTextWithBalancer(string $text, ?string $prompt = null): array
    {
        $this->lastAiUsage = null;

        $result = $this->aiLoadBalancer->analyzeJson(
            $prompt ?? $this->buildMedicalAnalysisPrompt($text),
            ['profile' => 'pdf_nativo']
        );

        $this->lastAiUsage = $this->aiLoadBalancer->lastUsage();

        return $result;
    }

    protected function buildUsagePayload(string $source, bool $cached = false): array
    {
        return array_merge(
            [
                'source' => $source,
                'cached' => $cached,
            ],
            $this->lastAiUsage ?? [
                'provider' => 'ai_load_balancer',
                'available' => false,
            ]
        );
    }

    protected function buildMedicalAnalysisPrompt(string $text, ?string $categoryName = null): string
    {
        $expected = $this->resolveCategoryExpectation($categoryName);
        $expectedRule = '';

        if (($expected['kind'] ?? null) === 'medical' && filled($expected['label'] ?? null)) {
            $expectedRule = "\n**VALIDACION DE CATEGORIA:**\nLa carpeta exige especificamente un documento de tipo {$expected['label']}. Si el archivo corresponde a otro examen distinto, contrato, anexo, certificado u otro documento, debes rechazarlo con es_examen_salud=false y explicar el motivo.\n";

            if (($expected['slug'] ?? null) === 'examen_altura') {
                $expectedRule .= "Para esta carpeta, la señal decisiva es que el documento mencione explicitamente `Altitud geográfica`, `Altura geográfica`, `Gran Altura Geográfica` o un rango equivalente como `3.000 a 5.500 m.s.n.m`.\n";
                $expectedRule .= "Si aparece esa señal, SI corresponde a la categoría aunque el tipo administrativo del examen diga `Preocupacional`, `Ocupacional`, `Trabajador Contratado`, `Evaluación de Salud` u otro nombre general.\n";
                $expectedRule .= "En ese caso debes devolver exactamente `\"tipo_examen\": \"Altitud Geografica\"`.\n";
            }
        }

        return <<<PROMPT
Eres un asistente médico especializado en análisis de exámenes de salud ocupacional.

**PASO 1 — VALIDACIÓN OBLIGATORIA:**
Antes de analizar, determina si el documento es un examen de salud médico/ocupacional.
Un examen de salud puede incluir: resultados de laboratorio, examen físico, evaluación médica ocupacional, ficha médica, informe de salud, examen preocupacional, periódico o de egreso.

Si el documento NO es un examen de salud (por ejemplo: contrato, anexo, liquidación, certificado, etc.), responde con este formato:
{
  "es_examen_salud": false,
  "tipo_documento": "contrato|anexo|otros",
  "trabajador": "Nombre completo del trabajador si se identifica",
  "motivo_rechazo": "Descripción breve de qué tipo de documento es",
  "nivel_alerta": "rejected"
}
{$expectedRule}

**PASO 2 — EXTRACCIÓN LITERAL (solo si es examen de salud):**
Si SÍ es un examen de salud, SOLO extrae la información textual del documento.
NO interpretes, NO deduzcas, NO contradigas la conclusión del examen.
Reglas obligatorias:
1. `estado_general` debe salir SOLO de la conclusión formal del examen. Si el documento no lo dice explícitamente, usa `sin_determinar`.
2. `drogas.detectado` solo puede ser `true` si el examen dice explícitamente `positivo` o `presuntamente positivo`.
3. Si el examen solo menciona hábitos, consumo declarado o recomendaciones preventivas, NO lo conviertas en positivo.
4. `resumen` debe ser descriptivo y fiel al documento, sin agregar interpretación clínica.
5. `nivel_alerta` puede reflejar los datos extraídos, pero nunca debe basarse en supuestos no escritos en el examen.
6. `fecha_vencimiento` debe extraerse priorizando etiquetas como `vigencia`, `vigente hasta`, `valido hasta`, `validez`, `fecha de vencimiento` o equivalentes.
7. Si una fecha aparece junto a la palabra `vigencia`, usa esa fecha como `fecha_vencimiento`.
8. Si el documento muestra fechas como `21/03/2024`, debes devolverlas normalizadas a `2024-03-21`.
9. Si el texto incluye `Peso`, `Talla`, `IMC`, `Presión arterial`, `Frecuencia cardiaca`, `ECG`, `Rx Tórax`, `Lake Louise`, `Glucosa`, `Creatinina`, `Hemoglobina`, `Colesterol` o `Triglicéridos`, debes extraerlos en `otros_hallazgos` o en `imc` cuando corresponda.
10. Si recibes dos bloques de texto y uno dice `TEXTO PDF EXTRAIDO DIRECTAMENTE`, prioriza ese bloque para valores literales y usa `CONTEXTO NOTEBOOKLM` solo como apoyo.
11. No omitas valores numéricos explícitos si aparecen junto a una etiqueta clínica.

Y responde ÚNICAMENTE en JSON con este esquema:
{
  "es_examen_salud": true,
  "tipo_examen": "Nombre específico del examen (ej: Preocupacional, Altura Geográfica, Psicosensométrico)",
  "resumen": "Texto breve de 2-3 oraciones resumiendo el estado",
  "trabajador": "Nombre completo del trabajador o null",
  "trabajador_rut": "RUT del trabajador en formato XX.XXX.XXX-X o null",
  "fecha_examen": "Fecha del documento o null",
  "fecha_vencimiento": "Fecha de vigencia o null",
  "imc": {
    "valor": número o null,
    "categoria": "Normal|Sobrepeso|Obesidad I|Obesidad II|Obesidad III|Sin datos",
    "alerta": bool (true si imc > 27),
    "critico": bool (true si imc > 32),
    "detalle": "Breve nota sobre el peso/talla"
  },
  "drogas": {
    "detectado": bool,
    "sustancias": ["lista de sustancias detectadas"],
    "alerta": bool (true si hay cualquier positivo),
    "critico": bool (SIEMPRE true si detectado es true),
    "detalle": "Descripción de hallazgos toxicológicos"
  },
  "otros_hallazgos": [
    {"titulo": "string", "valor": "string", "alerta": bool}
  ],
  "estado_general": "apto|apto_con_restricciones|no_apto|sin_determinar (solo si aparece explícito en el examen)",
  "nivel_alerta": "clean|alert|critical"
}

TEXTO DEL DOCUMENTO:
{$text}
PROMPT;
    }

    protected function enforceCategoryRules(array $analysisData, ?string $categoryName): array
    {
        $expected = $this->resolveCategoryExpectation($categoryName);

        if (($expected['kind'] ?? null) !== 'medical' || blank($expected['slug'] ?? null)) {
            return $analysisData;
        }

        if (($analysisData['es_examen_salud'] ?? false) !== true) {
            return $analysisData;
        }

        $actualType = $this->normalizeExamType($analysisData['tipo_examen'] ?? null);
        if ($actualType === $expected['slug']) {
            return $analysisData;
        }

        return [
            'es_examen_salud' => false,
            'tipo_documento' => $actualType ?? 'otro',
            'tipo_examen' => $analysisData['tipo_examen'] ?? null,
            'trabajador' => $analysisData['trabajador'] ?? null,
            'trabajador_rut' => $analysisData['trabajador_rut'] ?? null,
            'motivo_rechazo' => "El archivo no corresponde a la categoria {$expected['label']}.",
            'resumen' => "El archivo no corresponde a la categoria {$expected['label']}.",
            'nivel_alerta' => 'rejected',
        ];
    }

    protected function resolveMedicalStatus(array $analysisData): string
    {
        return isset($analysisData['es_examen_salud']) && $analysisData['es_examen_salud'] === false
            ? 'rejected'
            : ($analysisData['nivel_alerta'] ?? 'alert');
    }

    protected function normalizeAnalysisError(\Throwable $e): string
    {
        $errorMsg = $e->getMessage();

        if (str_contains($errorMsg, 'cURL error 6') || str_contains($errorMsg, 'Could not resolve host')) {
            $errorMsg = 'Sin conexión con la IA. No se pudo resolver el host del proveedor. Verifica tu internet.';
            Log::error('[AI-LB] ===== SIN CONEXIÓN CON LA IA ===== '.$e->getMessage());
        } elseif (
            str_contains(strtolower($errorMsg), 'quota')
            || str_contains($errorMsg, 'RESOURCE_EXHAUSTED')
            || str_contains(strtolower($errorMsg), 'rate limit')
            || str_contains(strtolower($errorMsg), 'too many requests')
        ) {
            $errorMsg = 'Límite de cuota o rate limit excedido en el proveedor de IA. Favor esperar unos segundos.';
            Log::warning('[AI-LB] Cuota o rate limit agotado: '.$e->getMessage());
        } elseif (str_contains($errorMsg, 'Se agotaron todas las rutas de IA')) {
            Log::error('[AI-LB] ===== TODAS LAS RUTAS FALLARON ===== '.$e->getMessage());
        } else {
            Log::error('[AI-LB] Error inesperado durante el análisis: '.$e->getMessage());
        }

        return $errorMsg;
    }

    protected function getDocumentBinary(Document $document): string
    {
        if ($this->isStagedPath($document->file_path)) {
            return Storage::disk('local')->get($document->file_path);
        }

        return Storage::disk('google')->get($document->file_path);
    }

    protected function enforceMedicalRules(array $analysisData, string $text): array
    {
        if (($analysisData['es_examen_salud'] ?? false) !== true) {
            return $analysisData;
        }

        $normalizedText = str($text)->lower()->ascii()->value();

        $identity = $this->resolveWorkerIdentity(
            $analysisData['trabajador_rut'] ?? null,
            $analysisData['document_number'] ?? null,
            $text
        );
        $analysisData['trabajador_rut'] = $identity['worker_rut'];
        $analysisData['document_number'] = $identity['document_number'];
        $analysisData['document_number_type'] = $identity['document_number_type'];

        if ($this->textIndicatesHeightExam($normalizedText)) {
            $analysisData['tipo_examen'] = 'Altitud Geografica';
        }

        if (blank($analysisData['fecha_vencimiento'] ?? null)) {
            $analysisData['fecha_vencimiento'] = $this->extractDateByLabels($text, [
                'vigencia del informe',
                'vigencia',
                'vigente hasta',
                'valido hasta',
                'válido hasta',
                'fecha de vencimiento',
            ]);
        }

        if (blank($analysisData['fecha_examen'] ?? null)) {
            $analysisData['fecha_examen'] = $this->extractDateByLabels($text, [
                'fecha evaluacion',
                'fecha de evaluacion',
                'fecha evaluación',
                'fecha examen',
                'fecha del examen',
                'fecha emision del informe',
                'fecha de emision del informe',
            ]);
        }

        $imc = $analysisData['imc'] ?? [];
        $bodyMeasurements = $this->extractBodyMeasurements($text);
        $imcValue = $this->extractNumericValue($imc['valor'] ?? null) ?? $this->extractLabeledNumericValue($text, ['IMC']);
        if ($imcValue === null && $bodyMeasurements['weight_kg'] !== null && $bodyMeasurements['height_m'] !== null && $bodyMeasurements['height_m'] > 0) {
            $imcValue = $bodyMeasurements['weight_kg'] / ($bodyMeasurements['height_m'] ** 2);
        }
        if ($imcValue !== null) {
            $imc['valor'] = round($imcValue, 2);
            $imc['categoria'] = $this->resolveImcCategory($imcValue);
            $imc['alerta'] = $imcValue > 27;
            $imc['critico'] = $imcValue > 32;
            if (blank($imc['detalle'] ?? null) && ($bodyMeasurements['weight_kg'] !== null || $bodyMeasurements['height_m'] !== null)) {
                $parts = [];
                if ($bodyMeasurements['weight_kg'] !== null) {
                    $parts[] = 'Peso '.round($bodyMeasurements['weight_kg'], 1).' kg';
                }
                if ($bodyMeasurements['height_m'] !== null) {
                    $parts[] = 'Talla '.round($bodyMeasurements['height_m'], 2).' m';
                }
                $imc['detalle'] = implode(' · ', $parts);
            }
        }

        $drogas = $analysisData['drogas'] ?? [];
        $detailNormalized = str((string) ($drogas['detalle'] ?? ''))->lower()->ascii()->value();
        $drugSignals = array_values(array_unique(array_merge(
            $this->detectDrugSignals($normalizedText),
            $this->detectDrugSignals($detailNormalized)
        )));

        $existingSubstances = collect($drogas['sustancias'] ?? [])
            ->filter()
            ->map(fn ($value) => str((string) $value)->lower()->ascii()->value())
            ->values()
            ->all();

        if (! empty($drugSignals)) {
            $existing = collect($drogas['sustancias'] ?? [])->filter()->values()->all();
            $drogas['detectado'] = true;
            $drogas['alerta'] = true;
            $drogas['critico'] = true;
            $drogas['sustancias'] = array_values(array_unique(array_merge($existing, $drugSignals)));
            $detail = trim((string) ($drogas['detalle'] ?? ''));
            $positiveText = 'Resultado positivo en toxicologia: '.implode(', ', $drugSignals).'.';
            $drogas['detalle'] = $detail ? $detail.' '.$positiveText : $positiveText;
        } elseif (
            $this->shouldClearLifestyleAlcoholFlag($normalizedText, $detailNormalized, $existingSubstances)
            || $this->hasExplicitNegativeToxicology($normalizedText, $detailNormalized)
        ) {
            $drogas['detectado'] = false;
            $drogas['alerta'] = false;
            $drogas['critico'] = false;
            $drogas['sustancias'] = [];
            if ($this->hasExplicitNegativeToxicology($normalizedText, $detailNormalized) && blank($drogas['detalle'] ?? null)) {
                $drogas['detalle'] = 'Sin deteccion';
            }
        }

        $analysisData['imc'] = $imc;
        $analysisData['drogas'] = $drogas;

        $isCritical = (bool) ($imc['critico'] ?? false) || (bool) ($drogas['detectado'] ?? false);
        $isAlert = (bool) ($imc['alerta'] ?? false) || (bool) ($drogas['alerta'] ?? false) || ! empty(array_filter($analysisData['otros_hallazgos'] ?? [], fn ($finding) => $finding['alerta'] ?? false));

        $analysisData['nivel_alerta'] = $isCritical ? 'critical' : ($isAlert ? 'alert' : 'clean');

        $formalFitness = $this->inferFormalFitnessFromText($normalizedText);
        if ($formalFitness !== null) {
            $analysisData['estado_general'] = $formalFitness;
        } elseif (blank($analysisData['estado_general'] ?? null)) {
            $analysisData['estado_general'] = 'sin_determinar';
        }

        return $analysisData;
    }

    protected function extractRutFromText(string $text): ?string
    {
        $labelPatterns = [
            '/numero\s+de\s+documento\s*[:\-]?\s*(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])/iu',
            '/rut\s+trabajador\s*[:\-]?\s*(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])/iu',
            '/nombre\s+[^\n]*\n?[^\n]*?(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])/iu',
        ];

        foreach ($labelPatterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $formatted = $this->formatRut($matches[1]);
                if ($formatted) {
                    return $formatted;
                }
            }
        }

        if (! preg_match_all('/\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])\b/u', $text, $matches, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        foreach ($matches[1] as [$candidate, $offset]) {
            $context = str($text)->substr(max(0, $offset - 40), 80)->lower()->ascii()->value();
            if (str_contains($context, 'empresa')) {
                continue;
            }

            $formatted = $this->formatRut($candidate);
            if ($formatted) {
                return $formatted;
            }
        }

        return null;
    }

    protected function extractLabeledNumericValue(string $text, array $labels): ?float
    {
        foreach ($labels as $label) {
            $pattern = '/'.preg_quote($label, '/').'\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/iu';
            if (preg_match($pattern, $text, $matches)) {
                return $this->extractNumericValue($matches[1]);
            }
        }

        return null;
    }

    protected function extractBodyMeasurements(string $text): array
    {
        $weightKg = $this->extractLabeledNumericValue($text, ['Peso', 'Peso corporal']);
        $heightRaw = $this->extractLabeledNumericValue($text, ['Talla', 'Estatura', 'Altura']);
        $heightM = null;

        if ($heightRaw !== null) {
            $heightM = $heightRaw > 3 ? $heightRaw / 100 : $heightRaw;
        }

        return [
            'weight_kg' => $weightKg,
            'height_m' => $heightM,
        ];
    }

    protected function extractDateByLabels(string $text, array $labels): ?string
    {
        foreach ($labels as $label) {
            $pattern = '/'.preg_quote($label, '/').'\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/iu';
            if (! preg_match($pattern, $text, $matches)) {
                continue;
            }

            $normalized = $this->normalizeDateString($matches[1]);
            if ($normalized) {
                return $normalized;
            }
        }

        return null;
    }

    protected function resolveImcCategory(float $imc): string
    {
        return match (true) {
            $imc >= 40 => 'Obesidad III',
            $imc >= 35 => 'Obesidad II',
            $imc >= 30 => 'Obesidad I',
            $imc >= 25 => 'Sobrepeso',
            $imc >= 18.5 => 'Normal',
            default => 'Bajo peso',
        };
    }

    protected function detectDrugSignals(string $normalizedText): array
    {
        $signals = [];
        $map = [
            'anfetaminas' => ['anfetaminas', 'anfetamina'],
            'benzodiazepinas' => ['benzodiazepinas', 'benzodiazepina'],
            'canabinoides' => ['canabinoides', 'cannabinoides', 'cannabis'],
            'cocaina' => ['cocaina', 'cocaina'],
            'alcohol' => ['alcohol etilico', 'alcohol'],
        ];

        foreach ($map as $label => $terms) {
            foreach ($terms as $term) {
                $quotedTerm = preg_quote($term, '/');
                $patterns = [
                    '/'.$quotedTerm.'\s*(?:#|:)?\s*presuntamente positivo/u',
                    '/'.$quotedTerm.'\s*(?:#|:)?\s*positivo/u',
                    '/presuntamente positivo(?:\s+(?:para|de))?\s+'.$quotedTerm.'/u',
                    '/positivo(?:\s+(?:para|de))?\s+'.$quotedTerm.'/u',
                    '/resultado\s+presuntamente\s+positivo(?:\s+(?:para|de))?\s+'.$quotedTerm.'/u',
                    '/resultado\s+positivo(?:\s+(?:para|de))?\s+'.$quotedTerm.'/u',
                ];

                if (collect($patterns)->contains(fn (string $pattern) => preg_match($pattern, $normalizedText) === 1)) {
                    $signals[] = $label;
                    break;
                }
            }
        }

        return array_values(array_unique($signals));
    }

    protected function hasExplicitNegativeToxicology(string $normalizedText, string $detailNormalized = ''): bool
    {
        $haystack = trim($normalizedText.' '.$detailNormalized);

        if (! empty($this->detectDrugSignals($haystack))) {
            return false;
        }

        $negativeMarkers = [
            'sin deteccion',
            'sin detecciones',
            'sin presencia',
            'no se detectaron',
            'no se detecta',
            'no se detectaron sustancias',
            'no se reportan examenes de toxicologia, drogas o alcohol',
            'negativo',
            'resultado negativo',
        ];

        foreach ($negativeMarkers as $marker) {
            if (str_contains($haystack, $marker)) {
                return true;
            }
        }

        return false;
    }

    protected function shouldClearLifestyleAlcoholFlag(string $normalizedText, string $detailNormalized, array $existingSubstances): bool
    {
        if (empty($existingSubstances) || array_values(array_unique($existingSubstances)) !== ['alcohol']) {
            return false;
        }

        if (! empty($this->detectDrugSignals($normalizedText)) || ! empty($this->detectDrugSignals($detailNormalized))) {
            return false;
        }

        $haystack = trim($normalizedText.' '.$detailNormalized);
        $lifestyleMarkers = [
            'bebe alcohol',
            'bebe socialmente',
            'consumo habitual de alcohol',
            'consumo ocasional de alcohol',
            'consumo social de alcohol',
            'refiere consumo de alcohol',
            'reporta consumo de alcohol',
        ];

        foreach ($lifestyleMarkers as $marker) {
            if (str_contains($haystack, $marker)) {
                return true;
            }
        }

        return false;
    }

    protected function inferFormalFitnessFromText(string $normalizedText): ?string
    {
        $aptoMarkers = [
            'no evidencia alteracion de salud para ejecutar la tarea',
            'no evidencia alteracion de salud para desempenar la tarea',
            'salud compatible para ejecutar la tarea',
            'salud compatible con la exposicion al riesgo',
            'apto para la tarea',
            'aprobado',
            'conclusion apto',
        ];

        foreach ($aptoMarkers as $marker) {
            if (str_contains($normalizedText, $marker)) {
                return 'apto';
            }
        }

        $noAptoMarkers = [
            'no apto',
            'salud incompatible con la exposicion al riesgo',
            'no evidencia salud compatible',
            'contraindica la tarea',
            'no compatible con la tarea',
        ];

        foreach ($noAptoMarkers as $marker) {
            if (str_contains($normalizedText, $marker)) {
                return 'no_apto';
            }
        }

        return null;
    }

    protected function formatRut(mixed $value): ?string
    {
        if (! is_string($value) || blank($value)) {
            return null;
        }

        $rut = strtoupper(preg_replace('/[^0-9Kk]/', '', $value));
        if (strlen($rut) < 2) {
            return null;
        }

        $body = substr($rut, 0, -1);
        $dv = substr($rut, -1);

        if (! ctype_digit($body)) {
            return null;
        }

        if ($this->calculateRutDv($body) !== $dv) {
            return null;
        }

        return ltrim($body, '0').'-'.$dv;
    }

    protected function calculateRutDv(string $body): string
    {
        $sum = 0;
        $multiplier = 2;

        for ($i = strlen($body) - 1; $i >= 0; $i--) {
            $sum += ((int) $body[$i]) * $multiplier;
            $multiplier = $multiplier === 7 ? 2 : $multiplier + 1;
        }

        $remainder = 11 - ($sum % 11);

        return match ($remainder) {
            11 => '0',
            10 => 'K',
            default => (string) $remainder,
        };
    }

    protected function persistMedicalExam(Document $document, array $analysisData, string $analysisStatus): void
    {
        if (($analysisData['es_examen_salud'] ?? false) !== true) {
            return;
        }

        $match = app(WorkerMatchService::class)->findBestMatch(
            $analysisData['trabajador_rut'] ?? null,
            $analysisData['trabajador'] ?? null
        );
        $worker = $match['worker'] ?? null;

        $findings = $this->collectFindings($analysisData);
        $examType = $this->normalizeExamType($analysisData['tipo_examen'] ?? null);
        $fitness = $this->normalizeFitness($analysisData['estado_general'] ?? null);
        $examDate = $this->normalizeDateString($analysisData['fecha_examen'] ?? null);
        $expiresAt = $this->normalizeDateString($analysisData['fecha_vencimiento'] ?? null);

        OccupationalExam::query()->updateOrCreate(
            ['document_id' => $document->id],
            [
                'worker_id' => $worker?->id,
                'worker_name' => $analysisData['trabajador'] ?? null,
                'worker_rut' => $analysisData['trabajador_rut'] ?? null,
                'document_number' => $analysisData['document_number'] ?? null,
                'document_number_type' => $analysisData['document_number_type'] ?? null,
                'exam_type' => $examType,
                'exam_date' => $examDate,
                'expires_at' => $expiresAt,
                'status' => $analysisStatus,
                'fitness' => $fitness,
                'summary' => $analysisData['resumen'] ?? null,
                'imc_value' => $this->extractNumericValue(data_get($analysisData, 'imc.valor')),
                'imc_category' => data_get($analysisData, 'imc.categoria'),
                'imc_alert' => (bool) data_get($analysisData, 'imc.alerta', false),
                'imc_critical' => (bool) data_get($analysisData, 'imc.critico', false),
                'toxicology_status' => $this->resolveToxicologyStatus($analysisData),
                'toxicology_detail' => data_get($analysisData, 'drogas.detalle'),
                'alcohol_detected' => $this->detectAlcohol($analysisData),
                'drugs_detected' => (bool) data_get($analysisData, 'drogas.detectado', false),
                'blood_pressure' => $this->extractFindingText($findings, ['presion arterial']),
                'total_cholesterol' => $this->extractNumericFinding($findings, ['colesterol total']),
                'hdl_cholesterol' => $this->extractNumericFinding($findings, ['colesterol hdl', 'hdl']),
                'ldl_cholesterol' => $this->extractNumericFinding($findings, ['colesterol ldl', 'ldl']),
                'triglycerides' => $this->extractNumericFinding($findings, ['trigliceridos', 'triglicéridos']),
                'glucose' => $this->extractNumericFinding($findings, ['glicemia', 'glucosa']),
                'pulse' => $this->extractNumericFinding($findings, ['pulso']),
                'respiratory_rate' => $this->extractNumericFinding($findings, ['frecuencia respiratoria']),
                'hemoglobin' => $this->extractNumericFinding($findings, ['hemoglobina']),
                'creatinine' => $this->extractNumericFinding($findings, ['creatinina']),
                'electrocardiogram' => $this->extractFindingText($findings, ['electrocardiograma']),
                'chest_xray' => $this->extractFindingText($findings, ['radiografia torax pa', 'radiografía tórax pa', 'radiografia torax', 'radiografía tórax']),
                'framingham_index' => $this->extractFindingText($findings, ['indice de framingham', 'índice de framingham', 'framingham']),
                'lake_louise_score' => $this->extractFindingText($findings, ['encuesta de lake louise', 'lake louise']),
                'findings' => $findings,
                'recommendations' => $this->collectRecommendations($analysisData, $findings),
                'restrictions' => $this->collectRestrictions($analysisData),
                'raw_analysis' => $analysisData,
            ]
        );

        if (! $worker || ! $examType) {
            return;
        }

        $existingWorkerDocument = WorkerDocument::query()
            ->withTrashed()
            ->where('worker_id', $worker->id)
            ->where('tipo', $examType)
            ->first();

        WorkerDocument::query()->updateOrCreate(
            ['worker_id' => $worker->id, 'tipo' => $examType],
            [
                'tiene_documento' => true,
                'fecha_emision' => $examDate,
                'fecha_vencimiento' => $this->latestDate(
                    $existingWorkerDocument?->fecha_vencimiento,
                    $expiresAt
                ),
                'archivo_referencia' => $document->file_path,
                'resultado_ia' => $analysisData,
                'descripcion' => '[Gemini] '.($analysisData['resumen'] ?? ''),
                'estado' => $this->mapWorkerDocumentStatus($analysisStatus),
            ]
        );
    }

    protected function latestDate(mixed $current, mixed $incoming): ?string
    {
        $currentDate = $this->parseDateValue($current);
        $incomingDate = $this->parseDateValue($incoming);

        if (! $currentDate) {
            return $incomingDate?->toDateString();
        }

        if (! $incomingDate) {
            return $currentDate->toDateString();
        }

        return $incomingDate->greaterThan($currentDate)
            ? $incomingDate->toDateString()
            : $currentDate->toDateString();
    }

    protected function parseDateValue(mixed $value): ?Carbon
    {
        if ($value instanceof Carbon) {
            return $value->copy()->startOfDay();
        }

        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value)->startOfDay();
        }

        if (! is_string($value) || blank($value)) {
            return null;
        }

        $normalized = trim($value);

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
            try {
                return Carbon::createFromFormat($format, $normalized)->startOfDay();
            } catch (\Throwable) {
                // Fallback to the next accepted format.
            }
        }

        try {
            return Carbon::parse($normalized)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function normalizeDateString(mixed $value): ?string
    {
        return $this->parseDateValue($value)?->toDateString();
    }

    protected function normalizeExamType(?string $examType): ?string
    {
        if (blank($examType)) {
            return null;
        }

        $normalized = str($examType)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();

        if (
            str_contains($normalized, 'altura')
            || str_contains($normalized, 'altitud')
            || (str_contains($normalized, 'geografica') && str_contains($normalized, '3000'))
        ) {
            return 'examen_altura';
        }

        if (str_contains($normalized, 'psico')) {
            return 'psicosensotecnico';
        }

        return 'otro';
    }

    protected function textIndicatesHeightExam(string $normalizedText): bool
    {
        foreach ([
            'altitud geografica',
            'altura geografica',
            'gran altura geografica',
            'riesgo altitud geografica',
            'riesgo altura geografica',
            '3.000 y 5.500 m.s.n.m',
            '3000 y 5500 m.s.n.m',
            '3000 a 5500 m.s.n.m',
            '3000 msnm',
            '5500 msnm',
        ] as $needle) {
            if (str_contains($normalizedText, str($needle)->lower()->ascii()->value())) {
                return true;
            }
        }

        return false;
    }

    protected function isGenericMedicalExamType(string $examType): bool
    {
        $normalized = str($examType)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()
            ->value();

        foreach ([
            'preocupacional',
            'ocupacional',
            'trabajador contratado',
            'evaluacion de salud',
            'periodico',
            'egreso',
        ] as $needle) {
            if (str_contains($normalized, $needle)) {
                return true;
            }
        }

        return false;
    }

    protected function resolveCategoryExpectation(?string $categoryName): array
    {
        $normalized = str((string) $categoryName)->lower()->ascii()->value();

        if (! str_contains($normalized, 'examen')) {
            return ['kind' => 'other'];
        }

        if (str_contains($normalized, 'altura')) {
            return ['kind' => 'medical', 'slug' => 'examen_altura', 'label' => 'Examen de Altura'];
        }

        if (str_contains($normalized, 'psico')) {
            return ['kind' => 'medical', 'slug' => 'psicosensotecnico', 'label' => 'Examen Psicosensotecnico'];
        }

        return ['kind' => 'medical', 'slug' => null, 'label' => trim((string) $categoryName)];
    }

    protected function normalizeFitness(?string $fitness): ?string
    {
        if (blank($fitness)) {
            return null;
        }

        return str($fitness)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();
    }

    protected function collectFindings(array $analysisData): array
    {
        $findings = collect($analysisData['otros_hallazgos'] ?? [])
            ->filter(fn ($finding) => is_array($finding) && filled($finding['titulo'] ?? null))
            ->values()
            ->all();

        if (filled(data_get($analysisData, 'imc.detalle'))) {
            $findings[] = [
                'titulo' => 'IMC detalle',
                'valor' => data_get($analysisData, 'imc.detalle'),
                'alerta' => (bool) data_get($analysisData, 'imc.alerta', false),
            ];
        }

        if (filled(data_get($analysisData, 'drogas.detalle'))) {
            $findings[] = [
                'titulo' => 'Toxicologia',
                'valor' => data_get($analysisData, 'drogas.detalle'),
                'alerta' => (bool) data_get($analysisData, 'drogas.alerta', false),
            ];
        }

        return $findings;
    }

    protected function collectRecommendations(array $analysisData, array $findings): array
    {
        $recommendations = [];

        if (filled($analysisData['resumen'] ?? null)) {
            $recommendations[] = $analysisData['resumen'];
        }

        foreach ($findings as $finding) {
            if (($finding['alerta'] ?? false) && filled($finding['valor'] ?? null)) {
                $recommendations[] = ($finding['titulo'] ?? 'Hallazgo').': '.$finding['valor'];
            }
        }

        return array_values(array_unique($recommendations));
    }

    protected function collectRestrictions(array $analysisData): array
    {
        $status = $analysisData['estado_general'] ?? null;
        if (blank($status)) {
            return [];
        }

        return [$status];
    }

    protected function resolveToxicologyStatus(array $analysisData): ?string
    {
        if ((bool) data_get($analysisData, 'drogas.detectado', false)) {
            return 'positivo';
        }

        if (filled(data_get($analysisData, 'drogas.detalle'))) {
            return 'negativo';
        }

        return null;
    }

    protected function detectAlcohol(array $analysisData): bool
    {
        $substances = collect(data_get($analysisData, 'drogas.sustancias', []))
            ->filter()
            ->map(fn ($value) => str((string) $value)->lower()->ascii()->value())
            ->values()
            ->all();

        if (in_array('alcohol', $substances, true)) {
            return true;
        }

        $detail = str((string) data_get($analysisData, 'drogas.detalle', ''))->lower()->ascii()->value();

        return ! empty($this->detectDrugSignals($detail)) && str_contains($detail, 'alcohol');
    }

    protected function extractFindingText(array $findings, array $needles): ?string
    {
        foreach ($findings as $finding) {
            $title = str((string) ($finding['titulo'] ?? ''))->lower()->ascii()->value();

            foreach ($needles as $needle) {
                $needleValue = str($needle)->lower()->ascii()->value();
                if (str_contains($title, $needleValue)) {
                    return $finding['valor'] ?? null;
                }
            }
        }

        return null;
    }

    protected function extractNumericFinding(array $findings, array $needles): ?float
    {
        return $this->extractNumericValue($this->extractFindingText($findings, $needles));
    }

    protected function extractNumericValue(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (! is_string($value) || blank($value)) {
            return null;
        }

        if (! preg_match('/-?\d+(?:[.,]\d+)?/', $value, $matches)) {
            return null;
        }

        return (float) str_replace(',', '.', $matches[0]);
    }

    protected function mapWorkerDocumentStatus(string $analysisStatus): string
    {
        return match ($analysisStatus) {
            'clean' => 'vigente',
            'alert', 'critical' => 'pendiente',
            'rejected' => 'pendiente',
            default => 'pendiente',
        };
    }

    public function isStagedPath(?string $path): bool
    {
        return filled($path) && str_starts_with($path, NotebookLMPipelineService::STAGING_PREFIX.'/');
    }

    protected function resolveWorkerIdentity(?string $candidateRut, ?string $candidateDocumentNumber, string $text): array
    {
        $validRut = $this->formatRut($candidateRut ?? '');
        if ($validRut) {
            return [
                'worker_rut' => $validRut,
                'document_number' => filled($candidateDocumentNumber) ? trim((string) $candidateDocumentNumber) : null,
                'document_number_type' => filled($candidateDocumentNumber) ? 'document_number' : null,
            ];
        }

        $documentNumber = $this->extractDocumentNumberFromText($text) ?? $candidateRut ?? $candidateDocumentNumber;
        if (filled($documentNumber)) {
            return [
                'worker_rut' => null,
                'document_number' => trim((string) $documentNumber),
                'document_number_type' => $this->inferDocumentNumberType((string) $documentNumber),
            ];
        }

        $extractedRut = $this->extractRutFromText($text);
        if ($extractedRut) {
            return [
                'worker_rut' => $extractedRut,
                'document_number' => filled($candidateDocumentNumber) ? trim((string) $candidateDocumentNumber) : null,
                'document_number_type' => filled($candidateDocumentNumber) ? 'document_number' : null,
            ];
        }

        return [
            'worker_rut' => null,
            'document_number' => null,
            'document_number_type' => null,
        ];
    }

    protected function extractDocumentNumberFromText(string $text): ?string
    {
        $patterns = [
            '/numero\s+de\s+documento\s*[:\-]?\s*([A-Z]?\d[\d.-]*)/iu',
            '/r\.?u\.?t\.?\s*[:\-]?\s*([A-Z]?\d[\d.-]*)\s*(?:edad|f\.?nac|valido|válido|$)/iu',
            '/r\.?u\.?t\.?\s*:\s*(?:edad\s*:?\s*f\.?nac\.?\s*:?\s*valido\s+hasta\s*:?\s*)?([A-Z]?\d[\d.-]*)/iu',
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $text, $matches)) {
                continue;
            }

            $value = preg_replace('/\s+/', '', trim((string) $matches[1]));
            if ($this->formatRut($value)) {
                continue;
            }

            $context = str((string) $matches[0])->lower()->ascii()->value();
            if (str_contains($context, 'empresa')) {
                continue;
            }

            return $value;
        }

        return null;
    }

    protected function inferDocumentNumberType(string $value): string
    {
        $normalized = strtoupper(trim($value));

        if (preg_match('/^[A-Z]+\d+$/', $normalized)) {
            return 'passport';
        }

        return 'document_number';
    }
}
