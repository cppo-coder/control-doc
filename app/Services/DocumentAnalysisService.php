<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class DocumentAnalysisService
{
    /**
     * Analiza un documento PDF de examen de salud con Gemini AI.
     */
    public function analyze(Document $document)
    {
        // 0. Validar que la carpeta sea de tipo EXAMEN
        $categoryName = strtolower($document->category->name);
        if (!str_contains($categoryName, 'examen')) {
            return [
                'success' => false,
                'error'   => 'Este documento no pertenece a una carpeta de exámenes de salud.'
            ];
        }

        // ── GUARDA: Si ya fue analizado exitosamente, no gastar tokens ──
        $successStatuses = ['clean', 'alert', 'critical', 'rejected'];
        if (in_array($document->analysis_status, $successStatuses) && $document->analysis_data) {
            return [
                'success' => true,
                'status'  => $document->analysis_status,
                'data'    => $document->analysis_data,
            ];
        }

        // 1. Descargar PDF desde Google Drive
        try {
            $fileContent = Storage::disk('google')->get($document->file_path);
        } catch (\Exception $e) {
            Log::error('Error descargando PDF de Drive: ' . $e->getMessage());
            return [
                'success' => false,
                'error'   => 'No se pudo descargar el archivo desde Google Drive.'
            ];
        }

        // Guardar temporalmente
        $tmpPath = sys_get_temp_dir() . '/doc_' . $document->id . '_' . time() . '.pdf';
        file_put_contents($tmpPath, $fileContent);

        // 2. Extraer texto del PDF
        $text = '';
        try {
            $parser = new Parser();
            $pdf    = $parser->parseFile($tmpPath);
            $text   = $pdf->getText();
        } catch (\Exception $e) {
            Log::warning('PDF parser falló durante el análisis: ' . $e->getMessage());
        } finally {
            @unlink($tmpPath);
        }

        if (empty(trim($text))) {
            $document->update([
                'analysis_status' => 'error',
                'analysis_data'   => ['error' => 'No fue posible extraer texto del PDF.'],
                'analyzed_at'     => now(),
            ]);
            return [
                'success' => false,
                'error'   => 'No fue posible extraer texto del PDF.'
            ];
        }

        // 3. Cache Check
        $contentHash = md5(trim($text));
        $cacheKey = "doc_analysis_" . $contentHash;

        try {
            $analysisData = cache()->remember($cacheKey, now()->addDays(30), function () use ($text) {
                $keys = config('services.gemini.keys', []);
                if (empty($keys)) {
                    throw new \Exception('No se ha configurado ninguna clave API de Gemini.');
                }

                $totalKeys = count($keys);
                // Modelos verificados: Orden invertido - empieza por los más livianos (mayor cuota)
                $models = [
                    'gemini-2.0-flash-lite',      // Mayor cuota disponible
                    'gemini-2.0-flash',           // Rápido y confiable
                    'gemini-2.5-pro',             // Alta calidad
                    'gemini-2.5-flash',           // Muy capaz
                    'gemini-3-flash-preview',     // Velocidad + calidad
                    'gemini-3.1-pro-preview',     // Máximo poder
                ];
                $lastError = '';

                // ESTRATEGIA MATRIZ: Recorrer todas las llaves, y para cada llave agotar todos los modelos
                for ($k = 0; $k < $totalKeys; $k++) {
                    $currentIndex = cache()->increment('gemini_api_key_rotator') % $totalKeys;
                    $geminiKey = $keys[$currentIndex];

                    foreach ($models as $model) {
                        try {
                            $prompt = <<<PROMPT
Eres un asistente médico especializado en análisis de exámenes de salud ocupacional.

**PASO 1 — VALIDACIÓN OBLIGATORIA:**
Antes de analizar, determina si el documento es un examen de salud médico/ocupacional.
Un examen de salud puede incluir: resultados de laboratorio, examen físico, evaluación médica ocupacional, ficha médica, informe de salud, examen preocupacional, periódico o de egreso.

Si el documento NO es un examen de salud (por ejemplo: contrato, factura, orden de compra, informe técnico, carta, plano, manual, certificado no médico, u otro tipo de documento), responde ÚNICAMENTE:
{
  "es_examen_salud": false,
  "motivo_rechazo": "Descripción breve de qué tipo de documento es y por qué no es un examen de salud",
  "nivel_alerta": "rejected"
}

**PASO 2 — ANÁLISIS (solo si es examen de salud):**
Si SÍ es un examen de salud, analiza:
1. **IMC**: Alerta si > 27, CRÍTICO si > 32. Calcula si hay peso y altura (IMC = kg/m²).
2. **Toxicología / Drogas / Alcohol**: SIEMPRE CRÍTICO si hay cualquier resultado positivo en antidoping, alcohol, CDT, GGT elevada u otros marcadores de consumo. Esto incluye cualquier sustancia detectada aunque sea en trazas.
3. **Sobrepeso u obesidad**: Normal (18.5-24.9), Sobrepeso (25-29.9), Obesidad I (30-34.9), II (35-39.9), III (≥40).

**REGLAS DE nivel_alerta (OBLIGATORIAS):**
- "critical" si: IMC > 32, O cualquier positivo en drogas/alcohol/toxicología.
- "alert" si: IMC entre 27 y 32, O hallazgos menores sin drogas ni alcohol.
- "clean" si: todo dentro de rangos normales y toxicología negativa.

Y responde ÚNICAMENTE en JSON con este esquema:
{
  "es_examen_salud": true,
  "resumen": "Texto breve de 2-3 oraciones resumiendo el estado",
  "trabajador": "Nombre completo del trabajador o null",
  "fecha_examen": "Fecha del documento o null",
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
  "estado_general": "apto|apto_con_restricciones|no_apto|sin_determinar",
  "nivel_alerta": "clean|alert|critical"
}

TEXTO DEL DOCUMENTO:
{$text}
PROMPT;

                            $response = Http::timeout(60)->post(
                                "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$geminiKey}",
                                [
                                    'contents' => [['parts' => [['text' => $prompt]]]],
                                    'generationConfig' => [
                                        'temperature'      => 0.1,
                                        'responseMimeType' => 'application/json',
                                    ],
                                ]
                            );

                            if ($response->successful()) {
                                $raw = $response->json('candidates.0.content.parts.0.text');
                                $raw = preg_replace('/^```json\s*/i', '', trim($raw));
                                $raw = preg_replace('/\s*```$/i', '', $raw);
                                return json_decode($raw, true);
                            }

                            $lastError = $response->body();
                            $status = $response->status();
                            
                            // Logueamos el fallo pero CONTINUAMOS con la matriz llave x modelo
                            Log::warning("Gemini Analysis Attempt Failed. KeyIndex: {$currentIndex}, Model: {$model}, Status: {$status}. Retrying other options...");
                            continue;

                        } catch (\Illuminate\Http\Client\ConnectionException $e) {
                            $lastError = $e->getMessage();
                            Log::error("[GEMINI] Sin conexión con la IA — No se pudo alcanzar la API de Gemini. Verifica tu conexión a internet. Modelo: {$model}, KeyIndex: {$currentIndex}. Detalle: " . $lastError);
                            continue;
                        } catch (\Exception $e) {
                            $lastError = $e->getMessage();
                            Log::warning("[GEMINI] Error en intento de análisis. Modelo: {$model}, KeyIndex: {$currentIndex}. Detalle: " . $lastError . ". Reintentando...");
                            continue;
                        }
                    }
                }

                throw new \Exception('Se agotaron todos los modelos y llaves disponibles. Último error: ' . $lastError);
            });

            // Update document with results
            if (isset($analysisData['es_examen_salud']) && $analysisData['es_examen_salud'] === false) {
                $document->update([
                    'analysis_status' => 'rejected',
                    'analysis_data'   => $analysisData,
                    'analyzed_at'     => now(),
                ]);
            } else {
                $document->update([
                    'analysis_status' => $analysisData['nivel_alerta'] ?? 'alert',
                    'analysis_data'   => $analysisData,
                    'analyzed_at'     => now(),
                ]);
            }

            return ['success' => true, 'status' => $document->analysis_status, 'data' => $analysisData];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $errorMsg = 'Sin conexión con la IA. Verifica tu acceso a internet e inténtalo de nuevo.';
            Log::error('[GEMINI] ===== SIN CONEXIÓN CON LA IA ===== No se pudo conectar con la API de Gemini. Detalle: ' . $e->getMessage());

            $document->update([
                'analysis_status' => 'error',
                'analysis_data'   => ['error' => $errorMsg],
                'analyzed_at'     => now(),
            ]);
            return ['success' => false, 'error' => $errorMsg];

        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();

            if (str_contains($errorMsg, 'cURL error 6') || str_contains($errorMsg, 'Could not resolve host')) {
                $errorMsg = 'Sin conexión con la IA. No se pudo resolver el host de Gemini. Verifica tu internet.';
                Log::error('[GEMINI] ===== SIN CONEXIÓN CON LA IA ===== No se pudo resolver el host. Detalle: ' . $e->getMessage());
            } elseif (str_contains($errorMsg, 'quota') || str_contains($errorMsg, 'RESOURCE_EXHAUSTED')) {
                $errorMsg = 'Límite de cuota excedido en Gemini (Free Tier). Favor esperar unos segundos.';
                Log::warning('[GEMINI] Cuota de API agotada: ' . $e->getMessage());
            } elseif (str_contains($errorMsg, 'agotaron todos los modelos')) {
                Log::error('[GEMINI] ===== TODOS LOS MODELOS Y LLAVES FALLARON ===== Último error: ' . $e->getMessage());
            } else {
                Log::error('[GEMINI] Error inesperado durante el análisis: ' . $e->getMessage());
            }

            $document->update([
                'analysis_status' => 'error',
                'analysis_data'   => ['error' => $errorMsg],
                'analyzed_at'     => now(),
            ]);
            return ['success' => false, 'error' => $errorMsg];
        }
    }
}
