<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class DocumentBulkUploadController extends Controller
{
    /**
     * Procesa UN solo archivo PDF: extrae texto, analiza con Gemini,
     * crea carpeta en Drive por trabajador y guarda en BD.
     * El frontend lo llama en loop para mostrar progreso por archivo.
     */
    public function upload(Request $request, Project $project)
    {
        set_time_limit(180);

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:30720', // 30 MB max
        ]);

        abort_if($project->user_id !== auth()->id(), 403);

        $file         = $request->file('file');
        $originalName = $file->getClientOriginalName();

        /* ── 1. Extraer texto del PDF ── */
        $text = '';
        try {
            $parser = new Parser();
            $pdf    = $parser->parseFile($file->getRealPath());
            $text   = trim($pdf->getText());
        } catch (\Exception $e) {
            Log::warning("PDF parser falló ({$originalName}): " . $e->getMessage());
        }

        /* ── 2. Analizar con Gemini (obtener nombre trabajador + alertas) ── */
        $analysisData = null;
        $geminiKey    = config('services.gemini.key');

        if (!empty($text) && !empty($geminiKey)) {
            $analysisData = $this->analyzeWithGemini($text, $geminiKey);
        }

        /* ── 2b. Si Gemini rechaza el documento (no es examen médico) ── */
        if ($analysisData && isset($analysisData['es_examen_salud']) && $analysisData['es_examen_salud'] === false) {
            return response()->json([
                'success'     => false,
                'rejected'    => true,
                'filename'    => $originalName,
                'worker_name' => null,
                'status'      => 'rejected',
                'resumen'     => null,
                'alerts'      => [[
                    'type' => 'error',
                    'msg'  => '⛔ El documento no corresponde a un examen de salud. ' . ($analysisData['motivo_rechazo'] ?? 'Tipo de documento no reconocido como examen médico.'),
                ]],
                'category_id' => null,
                'document_id' => null,
            ]);
        }

        /* ── 3. Determinar nombre del trabajador ── */
        $workerName = $analysisData['trabajador']
            ?? pathinfo($originalName, PATHINFO_FILENAME);

        // Sanear el nombre para uso en rutas de Drive
        $workerName = preg_replace('/[\/\\\\:*?"<>|]/', '_', $workerName);

        /* ── 4. Buscar o crear categoría con el nombre del trabajador ── */
        $category = $project->categories()->firstOrCreate(
            ['name' => $workerName]
        );

        /* ── 5. Subir PDF a Google Drive: Proyecto/Trabajador/archivo.pdf ── */
        $driveFolderPath = $project->name . '/' . $workerName;
        $driveFilePath   = $driveFolderPath . '/' . time() . '_' . $originalName;
        $driveError      = null;

        try {
            // Crear subcarpeta si no existe
            if (!Storage::disk('google')->directoryExists($driveFolderPath)) {
                Storage::disk('google')->makeDirectory($driveFolderPath);
            }
            Storage::disk('google')->put($driveFilePath, file_get_contents($file->getRealPath()));
        } catch (\Exception $e) {
            Log::error("Drive upload falló ({$originalName}): " . $e->getMessage());
            $driveError = 'Error al subir a Google Drive: ' . $e->getMessage();
        }

        /* ── 6. Guardar documento en BD ── */
        $document = $category->documents()->create([
            'name'             => $originalName,
            'file_path'        => $driveFilePath,
            'analysis_status'  => $analysisData['nivel_alerta'] ?? ($driveError ? 'error' : 'pending'),
            'analysis_data'    => $analysisData,
            'analyzed_at'      => $analysisData ? now() : null,
        ]);

        /* ── 7. Construir lista de alertas para el modal ── */
        $alerts = [];

        if ($driveError) {
            $alerts[] = ['type' => 'error', 'msg' => $driveError];
        }

        if ($analysisData) {
            $imc = $analysisData['imc'] ?? [];
            if (!empty($imc['critico'])) {
                $alerts[] = ['type' => 'critical', 'msg' => "IMC {$imc['valor']} — {$imc['categoria']}: {$imc['detalle']}"];
            } elseif (!empty($imc['alerta'])) {
                $alerts[] = ['type' => 'alert', 'msg' => "IMC {$imc['valor']} — {$imc['categoria']}: {$imc['detalle']}"];
            }

            $drogas = $analysisData['drogas'] ?? [];
            if (!empty($drogas['alerta'])) {
                $sustancias = implode(', ', $drogas['sustancias'] ?? []);
                $alerts[]   = ['type' => 'critical', 'msg' => 'Toxicología positiva' . ($sustancias ? ": {$sustancias}" : '') . '. ' . ($drogas['detalle'] ?? '')];
            }

            foreach ($analysisData['otros_hallazgos'] ?? [] as $h) {
                if (!empty($h['alerta'])) {
                    $alerts[] = ['type' => 'alert', 'msg' => "{$h['titulo']}: {$h['valor']}"];
                }
            }
        }

        if (empty($analysisData) && empty($driveError)) {
            $alerts[] = ['type' => 'info', 'msg' => 'No se pudo extraer texto del PDF para análisis (posible imagen escaneada).'];
        }

        return response()->json([
            'success'     => !$driveError,
            'filename'    => $originalName,
            'worker_name' => $workerName,
            'status'      => $analysisData['nivel_alerta'] ?? ($driveError ? 'error' : 'pending'),
            'resumen'     => $analysisData['resumen'] ?? null,
            'alerts'      => $alerts,
            'category_id' => $category->id,
            'document_id' => $document->id,
        ]);
    }

    /* ─────────────────────────────────────────── */
    private function analyzeWithGemini(string $text, string $apiKey): ?array
    {
        $prompt = <<<PROMPT
Eres un asistente médico especializado en análisis de exámenes de salud ocupacional.

**PASO 1 — VALIDACIÓN OBLIGATORIA:**
Determina si el documento es un examen de salud médico/ocupacional.
Ejemplos válidos: resultados de laboratorio, examen físico, evaluación médica ocupacional,
ficha médica, informe de salud, examen preocupacional, periódico o de egreso.

Si NO es un examen de salud (contrato, factura, orden de compra, informe técnico, carta, plano,
manual, certificado no médico, otro), responde SOLO:
{
  "es_examen_salud": false,
  "motivo_rechazo": "Descripción breve del tipo de documento y por qué no es examen médico",
  "nivel_alerta": "rejected"
}

**PASO 2 — ANÁLISIS (solo si es examen de salud):**
1. **IMC**: Alerta si > 27, CRÍTICO si > 32. Calcula si hay peso y altura (IMC = kg/m²).
2. **Toxicología**: Alerta si positivo en antidoping, CDT, GGT elevada u otros marcadores.
3. **Sobrepeso u obesidad**: Normal (18.5-24.9), Sobrepeso (25-29.9), Obesidad I-III (30+).

Responde SOLO en JSON:
{
  "es_examen_salud": true,
  "resumen": "string 2-3 oraciones",
  "trabajador": "nombre o null",
  "fecha_examen": "fecha o null",
  "imc": { "valor": number|null, "categoria": "Normal|Sobrepeso|Obesidad I|Obesidad II|Obesidad III|Sin datos", "alerta": bool, "critico": bool, "detalle": "string" },
  "drogas": { "detectado": bool, "sustancias": [], "alerta": bool, "detalle": "string" },
  "otros_hallazgos": [ {"titulo": "string", "valor": "string", "alerta": bool} ],
  "estado_general": "apto|apto_con_restricciones|no_apto|sin_determinar",
  "nivel_alerta": "clean|alert|critical"
}

TEXTO DEL DOCUMENTO:
{$text}
PROMPT;

        try {
            $response = Http::timeout(60)->post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={$apiKey}",
                [
                    'contents'         => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.1, 'responseMimeType' => 'application/json'],
                ]
            );

            if (!$response->successful()) {
                throw new \Exception($response->body());
            }

            $raw  = $response->json('candidates.0.content.parts.0.text');
            $raw  = preg_replace('/^```json\s*/i', '', trim($raw));
            $raw  = preg_replace('/\s*```$/i', '', $raw);
            $data = json_decode($raw, true);

            return json_last_error() === JSON_ERROR_NONE ? $data : null;
        } catch (\Exception $e) {
            Log::error('Gemini bulk analysis error: ' . $e->getMessage());
            return null;
        }
    }
}
