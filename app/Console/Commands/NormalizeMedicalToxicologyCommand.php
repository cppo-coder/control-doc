<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Services\DocumentAnalysisService;
use Illuminate\Console\Command;

class NormalizeMedicalToxicologyCommand extends Command
{
    protected $signature = 'documents:normalize-toxicology {--document-id=* : Limitar a IDs concretos de documentos}';

    protected $description = 'Reaplica las reglas de toxicologia sobre examenes ya analizados para corregir inconsistencias historicas';

    public function handle(DocumentAnalysisService $analysisService): int
    {
        $documentIds = collect((array) $this->option('document-id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values();

        $query = Document::query()
            ->with('category')
            ->whereNotNull('analysis_data')
            ->where(function ($builder) {
                $builder
                    ->whereIn('analysis_status', ['clean', 'alert', 'critical'])
                    ->orWhereRaw("analysis_data::text ILIKE '%es_examen_salud%'");
            });

        if ($documentIds->isNotEmpty()) {
            $query->whereIn('id', $documentIds->all());
        }

        $documents = $query->orderBy('id')->get();

        if ($documents->isEmpty()) {
            $this->warn('No se encontraron documentos para normalizar.');

            return self::SUCCESS;
        }

        $updated = 0;

        foreach ($documents as $document) {
            $analysisData = is_array($document->analysis_data) ? $document->analysis_data : [];

            if (($analysisData['es_examen_salud'] ?? false) !== true) {
                continue;
            }

            $before = json_encode([
                'status' => $document->analysis_status,
                'drogas' => $analysisData['drogas'] ?? null,
            ]);

            $result = $analysisService->normalizeStoredMedicalAnalysis($document, $analysisData);

            $after = json_encode([
                'status' => $result['status'] ?? $document->fresh()?->analysis_status,
                'drogas' => data_get($result, 'data.drogas'),
            ]);

            if ($before !== $after) {
                $updated++;
                $this->line("Actualizado documento #{$document->id} - {$document->name}");
            }
        }

        $this->info("Normalizacion completada. Documentos actualizados: {$updated}.");

        return self::SUCCESS;
    }
}
