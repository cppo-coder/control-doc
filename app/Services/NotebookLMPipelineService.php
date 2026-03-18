<?php

namespace App\Services;

use App\Jobs\AnalyzeDocumentJob;
use App\Models\Document;
use App\Models\DocumentCategory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class NotebookLMPipelineService
{
    public const STAGING_PREFIX = 'notebooklm-staging';

    public const PIPELINE_STATES = [
        'received',
        'uploaded_to_notebook',
        'indexing',
        'ready_for_query',
        'analyzed',
        'stored_in_drive',
        'failed',
    ];

    public function __construct(
        protected NotebookLMAnalysisService $notebookService,
        protected DocumentAnalysisService $documentAnalysisService,
        protected NotebookLMBridgeService $bridgeService,
    ) {}

    public function isPipelineCategory(DocumentCategory|string|null $category): bool
    {
        $name = $category instanceof DocumentCategory ? $category->name : (string) $category;
        $normalized = Str::of($name)->lower()->ascii()->value();

        return str_contains($normalized, 'examen')
            || str_contains($normalized, 'contrato')
            || str_contains($normalized, 'anexo');
    }

    public function preflightUpload(DocumentCategory $category, UploadedFile $file): ?array
    {
        if (! $this->isMedicalCategory($category)) {
            return null;
        }

        $analysis = $this->documentAnalysisService->analyzeUploadedPdf(
            $file->getRealPath(),
            $file->getClientOriginalName(),
            $category->name,
        );

        if (! ($analysis['success'] ?? false)) {
            return [
                'success' => false,
                'rejected' => false,
                'requires_review' => true,
                'status' => 'review',
                'pipeline_status' => null,
                'filename' => $file->getClientOriginalName(),
                'worker_name' => null,
                'resumen' => $analysis['error'] ?? 'No fue posible confirmar automáticamente si el archivo corresponde a un examen válido.',
                'alerts' => [
                    [
                        'type' => 'warning',
                        'msg' => 'El filtro inicial no pudo confirmar automáticamente el tipo documental. Requiere revisión manual.',
                    ],
                ],
                'analysis_data' => [
                    'motivo_rechazo' => $analysis['error'] ?? 'No fue posible confirmar automáticamente si el archivo corresponde a un examen válido.',
                ],
            ];
        }

        $data = $analysis['data'] ?? [];
        $status = $analysis['status'] ?? null;

        if ($status !== 'rejected' && ($data['es_examen_salud'] ?? true) !== false) {
            return null;
        }

        return [
            'success' => false,
            'rejected' => true,
            'status' => 'rejected',
            'pipeline_status' => null,
            'filename' => $file->getClientOriginalName(),
            'worker_name' => $data['trabajador'] ?? null,
            'resumen' => $data['resumen'] ?? $data['motivo_rechazo'] ?? 'El archivo no corresponde al tipo de documento requerido por la carpeta.',
            'alerts' => [
                [
                    'type' => 'warning',
                    'msg' => $data['motivo_rechazo'] ?? 'El archivo no corresponde al tipo de documento requerido por la carpeta.',
                ],
            ],
            'analysis_data' => $data,
        ];
    }

    public function stageUpload(DocumentCategory $category, UploadedFile $file, ?string $batchId = null): Document
    {
        $category->loadMissing('project');
        $batchId ??= (string) Str::uuid();
        $notebook = $this->bridgeService->ensureNotebookForBatch($category, $batchId);

        $stagedPath = $this->storeStagedFile($category, $file);
        $fileHash = md5_file($file->getRealPath()) ?: md5((string) file_get_contents($file->getRealPath()));

        $document = $category->documents()->create([
            'name' => $file->getClientOriginalName(),
            'file_path' => $stagedPath,
            'analysis_status' => 'pending',
            'analysis_data' => [
                '_file' => [
                    'hash' => $fileHash,
                    'original_name' => $file->getClientOriginalName(),
                ],
                '_pipeline' => [
                    'batch_id' => $batchId,
                    'notebook_id' => $notebook['notebook_id'] ?? null,
                    'notebook_title' => $notebook['notebook_title'] ?? null,
                    'storage_stage' => 'staged_local',
                    'staged_disk' => 'local',
                    'final_disk' => 'google',
                ],
            ],
        ]);

        $tracking = $this->notebookService->registerNotebookDocument($document);
        if ($tracking && $this->notebookService->hasTrackingColumns()) {
            $tracking->forceFill([
                'sync_status' => 'received',
                'sync_error' => null,
            ])->save();
        }

        return $document;
    }

    public function enqueue(Document $document, string $mode = 'prepare'): void
    {
        if ($this->shouldProcessInline()) {
            AnalyzeDocumentJob::dispatchSync($document, $mode);

            return;
        }

        AnalyzeDocumentJob::dispatch($document, $mode);
    }

    public function prepare(Document $document): array
    {
        $document->loadMissing('category.project', 'notebooklmDocument');

        $tracking = $this->notebookService->registerNotebookDocument($document);
        if (! $tracking) {
            return ['success' => false, 'error' => 'No se pudo registrar el documento en NotebookLM.'];
        }

        try {
            $fileContent = $this->getDocumentBinary($document);
        } catch (\Throwable $e) {
            $this->markFailed($document, $tracking, 'No se pudo recuperar el PDF para procesamiento: '.$e->getMessage());

            return ['success' => false, 'error' => 'No se pudo recuperar el PDF para procesamiento.'];
        }

        try {
            $notebookId = $tracking->notebook_id ?: data_get($document->analysis_data, '_pipeline.notebook_id');
            if (blank($notebookId)) {
                $this->markFailed($document, $tracking, 'No se pudo resolver el cuaderno de NotebookLM.');

                return ['success' => false, 'error' => 'No se pudo resolver el cuaderno de NotebookLM.'];
            }

            $driveSource = $this->ensureDriveSource($document, $fileContent);
            if (! ($driveSource['success'] ?? false)) {
                $this->markFailed($document, $tracking, $driveSource['error'] ?? 'No se pudo preparar el PDF en Google Drive para NotebookLM.');

                return ['success' => false, 'error' => $driveSource['error'] ?? 'No se pudo preparar el PDF en Google Drive para NotebookLM.'];
            }

            if (blank($tracking->source_id) || str_starts_with((string) $tracking->source_id, 'src_pending_')) {
                $uploadedSource = $this->bridgeService->addDriveSource(
                    $notebookId,
                    $driveSource['drive_file_id'],
                    $document->name,
                    'pdf'
                );
                if (! ($uploadedSource['id'] ?? null)) {
                    $error = $uploadedSource['error'] ?? 'NotebookLM no devolvió un source_id real.';
                    $this->markFailed($document, $tracking, $error);

                    return ['success' => false, 'error' => $error];
                }

                $tracking->forceFill([
                    'notebook_id' => $notebookId,
                    'source_id' => $uploadedSource['id'],
                ])->save();

                if ($this->notebookService->hasTrackingColumns()) {
                    $tracking->forceFill([
                        'sync_status' => 'uploaded_to_notebook',
                        'sync_error' => null,
                    ])->save();
                }
            }

            if ($this->notebookService->hasTrackingColumns()) {
                $tracking->forceFill(['sync_status' => 'indexing'])->save();
            }

            $notebookContext = $this->loadNotebookContext($tracking->source_id);

            if (blank($notebookContext)) {
                $this->markFailed($document, $tracking, 'NotebookLM aún no devolvió contexto utilizable para el documento.');

                return ['success' => false, 'error' => 'NotebookLM aún no devolvió contexto utilizable para el documento.'];
            }

            $document->update([
                'analysis_status' => 'pending',
                'analysis_data' => array_merge(
                    collect(is_array($document->analysis_data) ? $document->analysis_data : [])
                        ->except('error')
                        ->all(),
                    [
                        '_pipeline' => array_merge(
                            is_array($document->analysis_data['_pipeline'] ?? null) ? $document->analysis_data['_pipeline'] : [],
                            [
                                'notebook_context_ready' => filled(trim($notebookContext)),
                                'storage_stage' => 'ready_for_query',
                            ]
                        ),
                    ]
                ),
                'analyzed_at' => null,
            ]);

            if ($this->notebookService->hasTrackingColumns()) {
                $tracking->forceFill(['sync_status' => 'ready_for_query'])->save();
            }

            return [
                'success' => true,
                'status' => $document->analysis_status,
                'data' => $document->analysis_data,
            ];
        } catch (\Throwable $e) {
            $this->markFailed($document, $tracking, $e->getMessage());

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function analyze(Document $document): array
    {
        $document->loadMissing('category.project', 'notebooklmDocument');

        $tracking = $this->notebookService->registerNotebookDocument($document);
        if (! $tracking) {
            return ['success' => false, 'error' => 'No se pudo registrar el documento en NotebookLM.'];
        }

        try {
            $fileContent = $this->getDocumentBinary($document);
        } catch (\Throwable $e) {
            $this->markFailed($document, $tracking, 'No se pudo recuperar el PDF para análisis: '.$e->getMessage());

            return ['success' => false, 'error' => 'No se pudo recuperar el PDF para análisis.'];
        }

        try {
            if (blank($tracking->source_id) || str_starts_with((string) $tracking->source_id, 'src_pending_')) {
                $prepared = $this->prepare($document);
                if (! ($prepared['success'] ?? false)) {
                    return $prepared;
                }

                $tracking = $tracking->fresh();
            }

            $notebookContext = $this->loadNotebookContext($tracking->source_id);

            if (blank($notebookContext)) {
                $this->markFailed($document, $tracking, 'NotebookLM aún no devolvió contexto utilizable para el documento.');

                return ['success' => false, 'error' => 'NotebookLM aún no devolvió contexto utilizable para el documento.'];
            }

            if (
                $document->analysis_data
                && $this->notebookService->hasTrackingColumns()
                && in_array($tracking->sync_status, ['analyzed', 'stored_in_drive'], true)
            ) {
                $analysisResult = [
                    'success' => true,
                    'status' => $document->analysis_status,
                    'data' => $document->analysis_data,
                ];
            } elseif ($this->isMedicalDocument($document)) {
                $pdfExtraction = $this->documentAnalysisService->extractTextForNotebook($fileContent, $document->name);
                $analysisResult = $this->documentAnalysisService->analyzeNotebookExtractedText(
                    $document,
                    $notebookContext,
                    $document->name,
                    $pdfExtraction['text'] ?? null
                );
            } else {
                $analysisResult = $this->notebookService->analyzeNotebookContext($document, $notebookContext);
            }

            if (! ($analysisResult['success'] ?? false)) {
                $this->markFailed($document, $tracking, $analysisResult['error'] ?? 'No fue posible completar el análisis.');

                return $analysisResult;
            }

            if ($this->notebookService->hasTrackingColumns()) {
                $tracking->forceFill([
                    'sync_status' => 'analyzed',
                    'sync_error' => null,
                    'synced_at' => now(),
                ])->save();
            }

            $storageResult = $this->storeInDrive($document, $analysisResult['data'] ?? []);
            if (! $storageResult['success']) {
                if ($this->notebookService->hasTrackingColumns()) {
                    $tracking->forceFill([
                        'sync_status' => 'failed',
                        'sync_error' => $storageResult['error'],
                        'synced_at' => now(),
                    ])->save();
                }

                return [
                    'success' => false,
                    'status' => 'error',
                    'data' => $analysisResult['data'] ?? [],
                    'error' => $storageResult['error'],
                ];
            }

            $analysisResult = $this->persistAnalysis($document, $analysisResult['data'] ?? [], $analysisResult['status'] ?? 'pending');

            if ($this->notebookService->hasTrackingColumns()) {
                $tracking->forceFill([
                    'sync_status' => 'stored_in_drive',
                    'sync_error' => null,
                    'synced_at' => now(),
                ])->save();
            }

            return $analysisResult;
        } catch (\Throwable $e) {
            $this->markFailed($document, $tracking, $e->getMessage());

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    protected function persistAnalysis(Document $document, array $analysisData, string $status): array
    {
        $pipeline = $analysisData['_pipeline'] ?? [];
        $analysisData['_pipeline'] = array_merge($pipeline, [
            'storage_stage' => $this->documentAnalysisService->isStagedPath($document->file_path)
                ? 'analysis_complete_drive_pending'
                : 'stored_in_drive',
            'final_disk' => 'google',
        ]);

        if ($this->isMedicalDocument($document)) {
            return $this->documentAnalysisService->applyMedicalAnalysis($document, $analysisData);
        }

        return $this->notebookService->applyContractAnalysis($document, $analysisData);
    }

    protected function storeInDrive(Document $document, array $analysisData): array
    {
        $pipeline = is_array($document->analysis_data['_pipeline'] ?? null)
            ? $document->analysis_data['_pipeline']
            : [];

        $tempDrivePath = $pipeline['drive_temp_path'] ?? null;
        $finalFileName = $this->buildAnalyzedFilename($document, $analysisData);
        $driveFolder = ($document->category?->project?->name ?? 'Sin Proyecto').'/'.($document->category?->name ?? 'Sin Categoria');
        $drivePath = $driveFolder.'/'.$finalFileName;

        try {
            if (! Storage::disk('google')->directoryExists($driveFolder)) {
                Storage::disk('google')->makeDirectory($driveFolder);
            }

            if (filled($tempDrivePath) && $tempDrivePath !== $drivePath) {
                Storage::disk('google')->move($tempDrivePath, $drivePath);
            }

            if ($this->documentAnalysisService->isStagedPath($document->file_path)) {
                Storage::disk('local')->delete($document->file_path);
            }

            $document->update([
                'name' => $finalFileName,
                'file_path' => $drivePath,
                'analysis_data' => array_merge(
                    is_array($document->analysis_data) ? $document->analysis_data : [],
                    [
                        '_pipeline' => array_merge($pipeline, [
                            'storage_stage' => 'stored_in_drive',
                            'final_disk' => 'google',
                            'drive_temp_path' => $tempDrivePath,
                            'drive_final_path' => $drivePath,
                        ]),
                    ]
                ),
            ]);

            return ['success' => true, 'path' => $drivePath];
        } catch (\Throwable $e) {
            Log::warning("[PIPELINE] Falló almacenamiento final en Drive para documento {$document->id}: ".$e->getMessage());

            return [
                'success' => false,
                'error' => 'El análisis terminó, pero el respaldo en Google Drive quedó pendiente.',
            ];
        }
    }

    protected function getDocumentBinary(Document $document): string
    {
        if ($this->documentAnalysisService->isStagedPath($document->file_path)) {
            return Storage::disk('local')->get($document->file_path);
        }

        return Storage::disk('google')->get($document->file_path);
    }

    protected function storeStagedFile(DocumentCategory $category, UploadedFile $file): string
    {
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $file->getClientOriginalName()) ?: 'document.pdf';
        $path = self::STAGING_PREFIX.'/project_'.$category->project_id.'/category_'.$category->id.'/'.Str::uuid().'_'.$safeName;

        Storage::disk('local')->put($path, file_get_contents($file->getRealPath()));

        return $path;
    }

    protected function markFailed(Document $document, $tracking, string $error): void
    {
        $currentAnalysis = is_array($document->analysis_data) ? $document->analysis_data : [];

        $document->update([
            'analysis_status' => 'error',
            'analysis_data' => array_merge($currentAnalysis, [
                'error' => $error,
                '_pipeline' => array_merge(($currentAnalysis['_pipeline'] ?? []), [
                    'storage_stage' => $this->documentAnalysisService->isStagedPath($document->file_path)
                        ? 'staged_local'
                        : 'google',
                ]),
            ]),
            'analyzed_at' => now(),
        ]);

        if ($tracking && $this->notebookService->hasTrackingColumns()) {
            $tracking->forceFill([
                'sync_status' => 'failed',
                'sync_error' => $error,
                'synced_at' => now(),
            ])->save();
        }
    }

    protected function isMedicalDocument(Document $document): bool
    {
        return str_contains(Str::of($document->category?->name)->lower()->ascii()->value(), 'examen');
    }

    protected function isMedicalCategory(DocumentCategory|string|null $category): bool
    {
        $name = $category instanceof DocumentCategory ? $category->name : (string) $category;

        return str_contains(Str::of($name)->lower()->ascii()->value(), 'examen');
    }

    protected function loadNotebookContext(string $sourceId): string
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $fulltext = $this->bridgeService->getSourceFulltext($sourceId);
            $content = trim((string) ($fulltext['content'] ?? ''));

            if (filled($content)) {
                return $content;
            }

            usleep(400000);
        }

        return '';
    }

    protected function ensureDriveSource(Document $document, string $fileContent): array
    {
        $currentAnalysis = is_array($document->analysis_data) ? $document->analysis_data : [];
        $pipeline = is_array($currentAnalysis['_pipeline'] ?? null) ? $currentAnalysis['_pipeline'] : [];
        $tempDrivePath = $pipeline['drive_temp_path'] ?? null;
        $tempDriveId = $pipeline['drive_temp_id'] ?? null;

        if (filled($tempDrivePath) && filled($tempDriveId)) {
            return [
                'success' => true,
                'drive_path' => $tempDrivePath,
                'drive_file_id' => $tempDriveId,
            ];
        }

        $projectName = $document->category?->project?->name ?? 'Sin Proyecto';
        $categoryName = $document->category?->name ?? 'Sin Categoria';
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $document->name) ?: 'document.pdf';
        $tempFolder = '_NotebookLM/'.$projectName.'/'.$categoryName;
        $tempPath = $tempFolder.'/'.$document->id.'_'.$safeName;

        try {
            if (! Storage::disk('google')->directoryExists($tempFolder)) {
                Storage::disk('google')->makeDirectory($tempFolder);
            }

            Storage::disk('google')->put($tempPath, $fileContent);
            $metadata = Storage::disk('google')->getAdapter()->getMetadata($tempPath);
            $driveFileId = $metadata?->extraMetadata()['id'] ?? null;

            if (blank($driveFileId)) {
                return [
                    'success' => false,
                    'error' => 'Google Drive no devolvió el identificador del PDF temporal.',
                ];
            }

            $document->update([
                'analysis_data' => array_merge($currentAnalysis, [
                    '_pipeline' => array_merge($pipeline, [
                        'storage_stage' => 'uploaded_to_drive_temp',
                        'drive_temp_path' => $tempPath,
                        'drive_temp_id' => $driveFileId,
                    ]),
                ]),
            ]);

            return [
                'success' => true,
                'drive_path' => $tempPath,
                'drive_file_id' => $driveFileId,
            ];
        } catch (\Throwable $e) {
            Log::warning("[PIPELINE] Falló carga temporal a Drive para documento {$document->id}: ".$e->getMessage());

            return [
                'success' => false,
                'error' => 'No se pudo subir el PDF temporal a Google Drive para enlazarlo con NotebookLM.',
            ];
        }
    }

    protected function buildAnalyzedFilename(Document $document, array $analysisData): string
    {
        $rut = $analysisData['trabajador_rut'] ?? $analysisData['document_number'] ?? 'sin_rut';
        $rut = strtoupper((string) preg_replace('/[^0-9A-Za-z-]+/', '', (string) $rut));

        $name = $analysisData['trabajador'] ?? $analysisData['trabajador_nombre'] ?? pathinfo($document->name, PATHINFO_FILENAME);
        $name = strtoupper((string) str($name)->ascii()->replaceMatches('/[^A-Za-z0-9]+/', '_')->trim('_'));

        $acronym = $this->resolveDocumentAcronym($document, $analysisData);

        return trim(implode('_', array_filter([$rut, $name, $acronym])), '_').'.pdf';
    }

    protected function resolveDocumentAcronym(Document $document, array $analysisData): string
    {
        if ($this->isMedicalDocument($document)) {
            return match ($analysisData['tipo_examen'] ?? null) {
                'Altitud Geografica',
                'Altitud Geográfica',
                'Altura Geografica', 'Altura Geográfica', 'examen_altura' => 'EAG',
                'psicosensotecnico' => 'PST',
                default => 'EXA',
            };
        }

        $normalizedCategory = Str::of($document->category?->name)->lower()->ascii()->value();

        if (str_contains($normalizedCategory, 'contrato')) {
            return 'CON';
        }

        if (str_contains($normalizedCategory, 'anexo')) {
            return 'ANX';
        }

        return 'DOC';
    }

    protected function shouldProcessInline(): bool
    {
        $forced = env('NOTEBOOKLM_PIPELINE_INLINE');
        if ($forced !== null) {
            return filter_var($forced, FILTER_VALIDATE_BOOL);
        }

        return false;
    }
}
