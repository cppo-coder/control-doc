<?php

namespace App\Jobs;

use App\Models\Document;
use App\Services\NotebookLMPipelineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AnalyzeDocumentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Reintentos máximos si falla
     */
    public int $tries = 3;

    /**
     * Timeout: 5 minutos (análisis PDF puede tardar)
     */
    public int $timeout = 300;

    /**
     * Backoff exponencial entre reintentos (segundos)
     */
    public array $backoff = [30, 60, 120];

    public function __construct(
        public readonly Document $document,
        public readonly string $mode = 'analyze',
    ) {}

    public function handle(NotebookLMPipelineService $service): void
    {
        Log::info("AnalyzeDocumentJob: iniciando para document #{$this->document->id}", [
            'mode' => $this->mode,
        ]);

        $result = $this->mode === 'prepare'
            ? $service->prepare($this->document)
            : $service->analyze($this->document);

        if (! ($result['success'] ?? false)) {
            Log::warning("AnalyzeDocumentJob: falló para document #{$this->document->id}", [
                'error' => $result['error'] ?? 'Unknown',
            ]);

            return;
        }

        if ($this->mode === 'prepare') {
            $document = $this->document->fresh(['category']);

            if (! $document || ! $service->isPipelineCategory($document->category)) {
                return;
            }

            $service->enqueue($document, 'analyze');
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("AnalyzeDocumentJob: job fallido para document #{$this->document->id}", [
            'error' => $e->getMessage(),
        ]);

        $this->document->update([
            'analysis_status' => 'error',
            'analysis_data' => array_merge($this->document->analysis_data ?? [], [
                'error' => 'El análisis falló tras varios intentos. '.$e->getMessage(),
            ]),
            'analyzed_at' => now(),
        ]);

        if (Schema::hasColumns('notebook_l_m_documents', ['sync_status', 'sync_error', 'synced_at'])) {
            $this->document->notebooklmDocument()?->update([
                'sync_status' => 'failed',
                'sync_error' => $e->getMessage(),
                'synced_at' => now(),
            ]);
        }
    }
}
