<?php

namespace App\Jobs;

use App\Models\Document;
use App\Services\DocumentAnalysisService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

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
        public readonly Document $document
    ) {}

    public function handle(DocumentAnalysisService $service): void
    {
        Log::info("AnalyzeDocumentJob: iniciando para document #{$this->document->id}");

        $result = $service->analyze($this->document);

        if (!($result['success'] ?? false)) {
            Log::warning("AnalyzeDocumentJob: falló para document #{$this->document->id}", [
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("AnalyzeDocumentJob: job fallido para document #{$this->document->id}", [
            'error' => $e->getMessage(),
        ]);

        $this->document->update([
            'analysis_status' => 'error',
            'analysis_data'   => ['error' => 'El análisis falló tras varios intentos. ' . $e->getMessage()],
            'analyzed_at'     => now(),
        ]);
    }
}
