<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class DocumentAnalysisController extends Controller
{
    /**
     * Analiza el PDF de examen de salud con Gemini AI.
     */
    public function analyze(Document $document)
    {
        // 0. Validar que la carpeta sea de tipo EXAMEN (seguridad de servidor)
        $categoryName = strtolower($document->category->name);
        if (!str_contains($categoryName, 'examen')) {
            Log::warning("Intento de análisis en carpeta prohibida: " . $document->category->name);
            return back()->withErrors(['analysis' => 'Este documento no pertenece a una carpeta de exámenes de salud.']);
        }

        // 1. Descargar PDF desde Google Drive a un archivo temporal
        try {
            $fileContent = Storage::disk('google')->get($document->file_path);
        } catch (\Exception $e) {
            Log::error('Error descargando PDF de Drive: ' . $e->getMessage());
            return back()->withErrors(['analysis' => 'No se pudo descargar el archivo desde Google Drive.']);
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
            Log::warning('PDF parser falló, se usará análisis base64: ' . $e->getMessage());
        } finally {
            @unlink($tmpPath);
        }

        if (empty(trim($text))) {
            $document->update([
                'analysis_status' => 'error',
                'analysis_data'   => ['error' => 'No fue posible extraer texto del PDF. El documento puede estar escaneado como imagen.'],
                'analyzed_at'     => now(),
            ]);
            return back();
        }

        // 3. Check Cache for this content
        $contentHash = md5(trim($text));
        $cacheKey = "doc_analysis_" . $contentHash;

        try {
            $analysisData = cache()->remember($cacheKey, now()->addDays(30), function () use ($text) {
                $geminiKey = config('services.gemini.key');

                $prompt = <<<PROMPT
Eres un asistente médico especializado en análisis de exámenes de salud ocupacional.

**PASO 1 — VALIDACIÓN OBLIGATORIA:**
Antes de analizar, determina si el documento es un examen de salud médico/ocupacional.
Un examen de salud puede incluir: resultados de laboratorio, examen físico, evaluación médica ocupacional,
ficha médica, informe de salud, examen preocupacional, periódico o de egreso, entre otros.

Si el documento NO es un examen de salud (por ejemplo: contrato, factura, orden de compra, informe técnico,
carta, plano, manual, certificado no médico, u otro tipo de documento), responde ÚNICAMENTE:
{
  "es_examen_salud": false,
  "motivo_rechazo": "Descripción breve de qué tipo de documento es y por qué no es un examen de salud",
  "nivel_alerta": "rejected"
}

**PASO 2 — ANÁLISIS (solo si es examen de salud):**
Si SÍ es un examen de salud, analiza:
1. **IMC**: Alerta si > 27, CRÍTICO si > 32. Calcula si hay peso y altura (IMC = kg/m²).
2. **Toxicología / Drogas / Alcohol**: Alerta si hay positivos en antidoping, CDT, GGT elevada u otros marcadores.
3. **Sobrepeso u obesidad**: Normal (18.5-24.9), Sobrepeso (25-29.9), Obesidad I (30-34.9), II (35-39.9), III (≥40).

Y responde ÚNICAMENTE en JSON:
{
  "es_examen_salud": true,
  "resumen": "Texto breve 2-3 oraciones",
  "trabajador": "Nombre o null",
  "fecha_examen": "Fecha o null",
  "imc": { "valor": número|null, "categoria": "Normal|Sobrepeso|Obesidad I|Obesidad II|Obesidad III|Sin datos", "alerta": bool, "critico": bool, "detalle": "string" },
  "drogas": { "detectado": bool, "sustancias": [], "alerta": bool, "detalle": "string" },
  "otros_hallazgos": [ {"titulo": "string", "valor": "string", "alerta": bool} ],
  "estado_general": "apto|apto_con_restricciones|no_apto|sin_determinar",
  "nivel_alerta": "clean|alert|critical"
}

TEXTO DEL DOCUMENTO:
{$text}
PROMPT;

                $response = Http::timeout(60)->post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$geminiKey}",
                    [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ],
                        'generationConfig' => [
                            'temperature'     => 0.1,
                            'responseMimeType' => 'application/json',
                        ],
                    ]
                );

                if (!$response->successful()) {
                    throw new \Exception('Gemini API error: ' . $response->body());
                }

                $raw = $response->json('candidates.0.content.parts.0.text');
                $raw = preg_replace('/^```json\s*/i', '', trim($raw));
                $raw = preg_replace('/\s*```$/i', '', $raw);
                
                return json_decode($raw, true);
            });

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('JSON inválido detectado.');
            }

            // Si Gemini determinó que NO es un examen de salud
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
        } catch (\Exception $e) {
            Log::error('Gemini análisis falló: ' . $e->getMessage());
            $document->update([
                'analysis_status' => 'error',
                'analysis_data'   => ['error' => 'Error al comunicarse con Gemini AI: ' . $e->getMessage()],
                'analyzed_at'     => now(),
            ]);
        }

        if (request()->wantsJson()) {
            return response()->json([
                'status' => $document->analysis_status,
                'data'   => $document->analysis_data,
            ]);
        }

        return back();
    }
}
