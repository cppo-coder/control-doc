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
2. **Toxicología / Drogas / Alcohol**: Alerta si hay positivos en antidoping, CDT, GGT elevada u otros marcadores.
3. **Sobrepeso u obesidad**: Normal (18.5-24.9), Sobrepeso (25-29.9), Obesidad I (30-34.9), II (35-39.9), III (≥40).

Y responde ÚNICAMENTE en JSON con este esquema:
{
  "es_examen_salud": true,
  "resumen": "Texto breve de 2-3 oraciones resumiendo el estado",
  "trabajador": "Nombre completo del trabajador o null",
  "fecha_examen": "Fecha del documento o null",
  "imc": { 
    "valor": número o null, 
    "categoria": "Normal|Sobrepeso|Obesidad I|Obisidad II|Obesidad III|Sin datos", 
    "alerta": bool (true si imc > 27), 
    "critico": bool (true si imc > 32), 
    "detalle": "Breve nota sobre el peso/talla" 
  },
  "drogas": { 
    "detectado": bool, 
    "sustancias": ["lista de sustancias"], 
    "alerta": bool, 
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

                        } catch (\Exception $e) {
                            $lastError = $e->getMessage();
                            Log::warning("Gemini Exception during attempt: " . $lastError . ". Retrying next...");
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
        } catch (\Exception $e) {
            Log::error('Gemini análisis falló: ' . $e->getMessage());
            
            // Intentar extraer el mensaje de cuota o permiso para guardarlo en la BD
            $errorMsg = $e->getMessage();
            if (str_contains($errorMsg, 'quota') || str_contains($errorMsg, 'RESOURCE_EXHAUSTED')) {
                $errorMsg = 'Límite de cuota excedido en Gemini (Free Tier). Favor esperar unos segundos.';
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
