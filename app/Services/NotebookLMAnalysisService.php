<?php

namespace App\Services;

use App\Models\Document;
use App\Models\NotebookLMConfig;
use App\Models\NotebookLMDocument;
use App\Models\WorkerDocument;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser;

/**
 * NotebookLM Analysis Service — Integración con MCP
 */
class NotebookLMAnalysisService
{
    // Notebook dedicado para análisis de anexos
    const NOTEBOOK_ID = 'e84d8744-ba4f-45a6-9c40-d9a75497a44f';

    /**
     * Analiza un anexo usando NotebookLM como motor de IA.
     */
    public function analizarAnexo(Document $document): array
    {
        return [
            'success' => false,
            'error' => 'El análisis directo fue reemplazado por el pipeline de NotebookLM.',
        ];
    }

    public function analyzeContent(Document $document, string $fileContent): array
    {
        $document->loadMissing('category.project', 'notebooklmDocument');

        $text = $this->extraerTexto($fileContent);
        $ocrMode = strlen(trim($text)) < 80;

        if ($ocrMode && empty($fileContent)) {
            return ['success' => false, 'error' => 'PDF vacío, imposible analizar.'];
        }

        $hash = $ocrMode ? md5($fileContent) : md5(trim($text));
        $cacheKey = "notebooklm_anexo_{$hash}";

        try {
            $analysisData = Cache::remember($cacheKey, now()->addDays(30), function () use ($text, $fileContent, $ocrMode, $document) {
                return $this->consultarNotebookLM($text, $fileContent, $ocrMode, $document);
            });

            return [
                'success' => true,
                'status' => $this->resolveContractStatus($analysisData),
                'data' => array_merge($analysisData, ['_motor' => 'notebooklm']),
                'motor' => 'notebooklm',
            ];
        } catch (\Exception $e) {
            Log::error("[NOTEBOOKLM] Error analizando doc {$document->id}: ".$e->getMessage());

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function analyzeNotebookContext(Document $document, string $context): array
    {
        try {
            $analysisData = $this->queryContextWithGemini($document, $context);

            return [
                'success' => true,
                'status' => $this->resolveContractStatus($analysisData),
                'data' => array_merge($analysisData, ['_motor' => 'notebooklm']),
                'motor' => 'notebooklm',
            ];
        } catch (\Throwable $e) {
            Log::error("[NOTEBOOKLM] Error analizando contexto de notebook para doc {$document->id}: ".$e->getMessage());

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function consultarNotebookLM(string $text, string $fileContent, bool $ocrMode, Document $document): array
    {
        $contextoTexto = $ocrMode ? "DOC_IMAGE_{$document->name}" : substr($text, 0, 10000);
        $result = $this->queryContextWithGemini($document, $contextoTexto);

        if ($result === null) {
            throw new \Exception('NotebookLM no devolvió resultados válidos.');
        }

        return $result;
    }

    private function llamarMcpScript(string $texto, string $prompt, string $nombre): ?array
    {
        $keys = config('services.gemini.keys', []);
        if (empty($keys)) {
            Log::error('[NOTEBOOKLM] No hay claves API de Gemini configuradas.');

            return null;
        }

        $totalKeys = count($keys);
        $models = ['gemini-2.0-flash', 'gemini-1.5-pro'];

        for ($k = 0; $k < $totalKeys; $k++) {
            $currentIndex = Cache::increment('gemini_api_key_rotator') % $totalKeys;
            $geminiKey = $keys[$currentIndex];

            foreach ($models as $model) {
                try {
                    $response = Http::timeout(60)->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$geminiKey}",
                        [
                            'contents' => [[
                                'parts' => [['text' => $prompt."\n\nTEXTO:\n".$texto]],
                            ]],
                            'generationConfig' => [
                                'temperature' => 0.1,
                                'responseMimeType' => 'application/json',
                            ],
                        ]
                    );

                    if ($response->successful()) {
                        $raw = $response->json('candidates.0.content.parts.0.text');
                        $raw = preg_replace('/^```json\s*/i', '', trim((string) $raw));
                        $raw = preg_replace('/\s*```$/i', '', $raw);
                        $decoded = json_decode($raw, true);

                        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                            return $decoded;
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning("[NOTEBOOKLM] Intento fallido con {$model}: ".$e->getMessage());
                }
            }
        }

        return null;
    }

    protected function queryContextWithGemini(Document $document, string $context): ?array
    {
        $prompt = $this->buildPrompt($document);

        $result = $this->llamarMcpScript($context, $prompt, $document->name);

        return is_array($result) ? $this->enforceCategoryRules($document, $result) : $result;
    }

    public function applyContractAnalysis(Document $document, array $data): array
    {
        $status = $this->resolveContractStatus($data);

        $document->update([
            'analysis_status' => $status,
            'analysis_data' => array_merge($data, ['_motor' => 'notebooklm']),
            'analyzed_at' => now(),
        ]);

        if (! empty($data['es_contrato'])) {
            $this->syncContratoChecklistPublico($document, $data);
        }

        return [
            'success' => true,
            'status' => $status,
            'data' => $document->analysis_data,
        ];
    }

    public function syncContratoChecklistPublico(Document $document, array $data): void
    {
        $match = app(WorkerMatchService::class)->findBestMatch(
            $data['trabajador_rut'] ?? null,
            $data['trabajador_nombre'] ?? null
        );

        $worker = $match['worker'] ?? null;
        if (! $worker) {
            $this->updateMatchedWorkerTracking($document, null);

            return;
        }

        $this->updateMatchedWorkerTracking($document, $worker->id);

        $tipo = $data['tipo_contrato'] ?? 'indefinido';

        $existingWorkerDocument = WorkerDocument::query()
            ->withTrashed()
            ->where('worker_id', $worker->id)
            ->where('tipo', 'contrato')
            ->first();

        WorkerDocument::updateOrCreate(
            ['worker_id' => $worker->id, 'tipo' => 'contrato'],
            [
                'tiene_documento' => true,
                'fecha_emision' => $data['fecha_inicio'] ?? null,
                'fecha_vencimiento' => $this->latestDate(
                    $existingWorkerDocument?->fecha_vencimiento,
                    $tipo === 'plazo_fijo' ? ($data['fecha_termino'] ?? null) : null
                ),
                'archivo_referencia' => $document->file_path,
                'resultado_ia' => $data,
                'descripcion' => '[NotebookLM] '.($data['resumen'] ?? ''),
            ]
        );

        $workerUpdate = [];
        if (empty($worker->position)) {
            $workerUpdate['position'] = $data['cargo'] ?? null;
        }
        if (empty($worker->tipo_contrato)) {
            $workerUpdate['tipo_contrato'] = $tipo;
        }
        if (! empty($workerUpdate)) {
            $worker->update(array_filter($workerUpdate));
        }
    }

    public function registerNotebookDocument(Document $document): ?NotebookLMDocument
    {
        $category = $document->relationLoaded('category')
            ? $document->getRelation('category')
            : $document->category()->first();

        if (! $category) {
            return null;
        }

        $pipelineNotebookId = data_get($document->analysis_data, '_pipeline.notebook_id');
        $config = filled($pipelineNotebookId)
            ? (object) ['notebook_id' => $pipelineNotebookId]
            : NotebookLMConfig::query()->where('document_category_id', $category->id)->first();

        if (! filled($config?->notebook_id)) {
            $config = app(NotebookLMBridgeService::class)->ensureNotebookForCategory($category);
        }

        if (! filled($config?->notebook_id)) {
            return null;
        }

        $tracking = NotebookLMDocument::query()->firstOrNew([
            'document_id' => $document->id,
        ]);

        $tracking->notebook_id = $config->notebook_id;

        if (blank($tracking->source_id)) {
            $tracking->source_id = 'src_pending_'.Str::uuid();
        }

        if ($this->hasTrackingColumns()) {
            if (! $tracking->exists && blank($tracking->sync_status)) {
                $tracking->sync_status = 'registered';
            }

            if (blank($tracking->sync_error)) {
                $tracking->sync_error = null;
            }
        }

        $tracking->save();

        return $tracking->fresh();
    }

    protected function markTrackingFailure(?NotebookLMDocument $tracking, string $error): void
    {
        if (! $tracking || ! $this->hasTrackingColumns()) {
            return;
        }

        $tracking->forceFill([
            'sync_status' => 'failed',
            'sync_error' => $error,
        ])->save();
    }

    protected function updateMatchedWorkerTracking(Document $document, ?int $workerId): void
    {
        $tracking = $document->notebooklmDocument()->first();
        if (! $tracking || ! Schema::hasColumn('notebook_l_m_documents', 'matched_worker_id')) {
            return;
        }

        $tracking->forceFill([
            'matched_worker_id' => $workerId,
        ])->save();
    }

    private function buildPrompt(Document $document): string
    {
        $catName = strtolower($document->category?->name ?? '');
        $expected = $this->resolveCategoryExpectation($document->category?->name);

        if (str_contains($catName, 'contrato') || str_contains($catName, 'anexo')) {
            $expectedRule = filled($expected['label'] ?? null)
                ? "La carpeta exige especificamente {$expected['label']}. Si el archivo no corresponde exactamente a ese tipo, responde JSON con es_contrato false, tipo_documento_detectado y motivo_rechazo."
                : '';

            return trim($expectedRule.' Analiza este documento laboral y extrae en JSON: trabajador_nombre, trabajador_rut (formato XX.XXX.XXX-X), tipo_documento_detectado (contrato|anexo|otro), tipo_contrato (plazo_fijo/indefinido/obra_faena), cargo, empresa, fecha_inicio (YYYY-MM-DD), fecha_termino (YYYY-MM-DD o null), resumen. Campo es_contrato: true.');
        }

        return 'Analiza este examen de salud ocupacional y extrae en JSON: es_examen_salud (true/false), trabajador_nombre, trabajador_rut, tipo_examen, fecha_examen (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), imc (valor, categoria, alerta), drogas (detectado, sustancias, critico), nivel_alerta (clean/alert/critical), resumen. Para fecha_vencimiento prioriza textos como vigencia, vigente hasta, valido hasta, validez o fecha de vencimiento. Si aparece una fecha en formato 21/03/2024 junto a vigencia, devuelvela como 2024-03-21.';
    }

    private function extraerTexto(string $fileContent): string
    {
        try {
            $tmpPath = sys_get_temp_dir().'/nblm_'.uniqid().'.pdf';
            file_put_contents($tmpPath, $fileContent);
            $parser = new Parser;
            $pdf = $parser->parseFile($tmpPath);
            $text = $pdf->getText();
            @unlink($tmpPath);

            return $text;
        } catch (\Exception $e) {
            return '';
        }
    }

    protected function resolveContractStatus(array $analysisData): string
    {
        if (($analysisData['es_contrato'] ?? false) !== true) {
            return 'rejected';
        }

        return $analysisData['es_contrato'] ?? false
            ? ($analysisData['fecha_termino'] ? 'contrato_alert' : 'contrato_ok')
            : ($analysisData['nivel_alerta'] ?? 'alert');
    }

    protected function enforceCategoryRules(Document $document, array $analysisData): array
    {
        $expected = $this->resolveCategoryExpectation($document->category?->name);
        if (($expected['kind'] ?? null) !== 'labor') {
            return $analysisData;
        }

        $actual = str((string) ($analysisData['tipo_documento_detectado'] ?? ($analysisData['es_contrato'] ?? false ? 'contrato' : 'otro')))
            ->lower()
            ->ascii()
            ->value();

        if ($actual === $expected['slug']) {
            return $analysisData;
        }

        return [
            'es_contrato' => false,
            'tipo_documento_detectado' => $actual ?: 'otro',
            'trabajador_nombre' => $analysisData['trabajador_nombre'] ?? null,
            'trabajador_rut' => $analysisData['trabajador_rut'] ?? null,
            'motivo_rechazo' => "El archivo no corresponde a la categoria {$expected['label']}.",
            'resumen' => "El archivo no corresponde a la categoria {$expected['label']}.",
            'nivel_alerta' => 'rejected',
        ];
    }

    protected function resolveCategoryExpectation(?string $categoryName): array
    {
        $normalized = str((string) $categoryName)->lower()->ascii()->value();

        if (str_contains($normalized, 'anexo')) {
            return ['kind' => 'labor', 'slug' => 'anexo', 'label' => 'Anexo'];
        }

        if (str_contains($normalized, 'contrato')) {
            return ['kind' => 'labor', 'slug' => 'contrato', 'label' => 'Contrato'];
        }

        return ['kind' => 'other'];
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

    public function hasTrackingColumns(): bool
    {
        return Schema::hasColumns('notebook_l_m_documents', [
            'sync_status',
            'sync_error',
            'synced_at',
        ]);
    }
}
