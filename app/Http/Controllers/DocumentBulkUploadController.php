<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use App\Models\Project;
use App\Services\DocumentDuplicateService;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMPipelineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class DocumentBulkUploadController extends Controller
{
    /**
     * Procesa una carga masiva para la categoria seleccionada en la vista.
     */
    public function upload(Request $request, Project $project, DocumentCategory $category, NotebookLMPipelineService $pipelineService, DocumentDuplicateService $duplicateService, NotebookLMAuthStatusService $notebookLMAuthStatusService)
    {
        set_time_limit(180);

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:30720',
            'batch_id' => 'nullable|string|max:100',
        ]);

        abort_if($project->user_id !== auth()->id() || $category->project_id !== $project->id, 403);

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $fileContent = file_get_contents($file->getRealPath());
        $duplicate = $duplicateService->findDuplicate($category, $fileContent);

        if ($duplicate) {
            $duplicate->loadMissing('notebooklmDocument');

            return response()->json([
                'success' => true,
                'duplicate' => true,
                'filename' => $originalName,
                'status' => 'duplicate',
                'pipeline_status' => $duplicate->notebooklmDocument?->sync_status,
                'resumen' => 'La informacion de este archivo ya existe en el sistema.',
                'alerts' => [
                    ['type' => 'warning', 'msg' => 'Este archivo ya existe en el sistema.'],
                ],
                'category_id' => $category->id,
                'category_name' => $category->name,
                'document_id' => $duplicate->id,
            ]);
        }

        $usesPipeline = $pipelineService->isPipelineCategory($category);
        $isMedicalPipeline = str_contains(str((string) $category->name)->lower()->ascii()->value(), 'examen');

        if ($usesPipeline) {
            if (! $isMedicalPipeline) {
                $preflight = $pipelineService->preflightUpload($category, $file);
                if ($preflight) {
                    return response()->json(array_merge($preflight, [
                        'category_id' => $category->id,
                        'category_name' => $category->name,
                    ]), 200);
                }
            }

            $status = $notebookLMAuthStatusService->status(fresh: true);
            if (($status['ok'] ?? false) !== true) {
                $message = $status['validation_error'] ?? $status['message'] ?? 'NotebookLM no esta disponible.';

                return response()->json([
                    'success' => false,
                    'filename' => $originalName,
                    'status' => 'error',
                    'pipeline_status' => 'failed',
                    'error' => $message,
                    'message' => $message,
                    'auth_status' => $status['status'] ?? 'error',
                ], 503);
            }

            $document = $pipelineService->stageUpload(
                $category,
                $file,
                $request->string('batch_id')->toString() ?: null
            );
            $pipelineService->enqueue($document, 'prepare');

            $document->loadMissing('notebooklmDocument');
            Cache::forget("project.{$project->id}.categories");

            return response()->json([
                'success' => true,
                'filename' => $originalName,
                'status' => $document->analysis_status,
                'pipeline_status' => $document->notebooklmDocument?->sync_status ?? 'received',
                'resumen' => ($document->notebooklmDocument?->sync_status ?? null) === 'ready_for_query'
                    ? 'Documento listo para analisis.'
                    : 'Documento recibido en la carpeta seleccionada.',
                'alerts' => [
                    ['type' => 'info', 'msg' => 'Documento recibido.'],
                    ['type' => 'info', 'msg' => ($document->notebooklmDocument?->sync_status ?? null) === 'ready_for_query'
                        ? 'NotebookLM listo.'
                        : 'En cola de procesamiento.'],
                ],
                'category_id' => $category->id,
                'category_name' => $category->name,
                'document_id' => $document->id,
            ]);
        }

        $fileName = time().'_'.$originalName;
        $drivePath = $project->name.'/'.$category->name.'/'.$fileName;

        Storage::disk('google')->put($drivePath, $fileContent);

        $document = $category->documents()->create([
            'name' => $originalName,
            'file_path' => $drivePath,
            'analysis_status' => 'pending',
            'analysis_data' => [
                '_file' => [
                    'hash' => $duplicateService->fileHash($fileContent),
                    'original_name' => $originalName,
                ],
            ],
            'analyzed_at' => null,
        ]);

        Cache::forget("project.{$project->id}.categories");

        return response()->json([
            'success' => true,
            'filename' => $originalName,
            'status' => $document->analysis_status,
            'pipeline_status' => null,
            'resumen' => 'Documento cargado en la carpeta seleccionada.',
            'alerts' => [
                ['type' => 'info', 'msg' => 'Documento cargado en Google Drive.'],
            ],
            'category_id' => $category->id,
            'category_name' => $category->name,
            'document_id' => $document->id,
        ]);
    }
}
