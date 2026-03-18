<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentDeletionLog;
use App\Services\DocumentDuplicateService;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMPipelineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function show(Document $document)
    {
        $this->authorize('view', $document);
        $document->loadMissing('notebooklmDocument');
        $hasNotebookTrackingColumns = Schema::hasColumns('notebook_l_m_documents', [
            'sync_status',
            'sync_error',
        ]);

        return response()->json([
            'id' => $document->id,
            'name' => $document->name,
            'analysis_status' => $document->analysis_status,
            'analyzed_at' => $document->analyzed_at,
            'analysis_data' => $document->analysis_data,
            'pipeline_status' => $hasNotebookTrackingColumns ? $document->notebooklmDocument?->sync_status : null,
            'pipeline_error' => $hasNotebookTrackingColumns ? $document->notebooklmDocument?->sync_error : null,
        ]);
    }

    public function store(Request $request, DocumentCategory $category, NotebookLMPipelineService $pipelineService, DocumentDuplicateService $duplicateService, NotebookLMAuthStatusService $notebookLMAuthStatusService)
    {
        $this->authorize('update', $category->project);

        $request->validate([
            'document' => 'required|file|mimes:pdf|max:20480',
        ]);

        $file = $request->file('document');
        $fileContent = file_get_contents($file->getRealPath());
        $duplicate = $duplicateService->findDuplicate($category, $fileContent);

        if ($duplicate) {
            $duplicate->loadMissing('notebooklmDocument');

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'document_id' => $duplicate->id,
                    'status' => $duplicate->analysis_status,
                    'pipeline_status' => $duplicate->notebooklmDocument?->sync_status,
                    'error' => 'La informacion de este archivo ya existe en el sistema.',
                ], 409);
            }

            return redirect()->back()->withErrors([
                'document' => 'La informacion de este archivo ya existe en el sistema.',
            ]);
        }

        $usesPipeline = $pipelineService->isPipelineCategory($category);

        if ($usesPipeline) {
            $preflight = $pipelineService->preflightUpload($category, $file);
            if ($preflight) {
                if ($request->expectsJson()) {
                    return response()->json($preflight, 200);
                }

                return redirect()->back()->withErrors([
                    'document' => $preflight['resumen'] ?? 'El archivo no corresponde al tipo de documento requerido por la carpeta.',
                ]);
            }

            $status = $notebookLMAuthStatusService->status(fresh: true);
            if (($status['ok'] ?? false) !== true) {
                $message = $status['validation_error'] ?? $status['message'] ?? 'NotebookLM no esta disponible.';

                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'status' => 'error',
                        'pipeline_status' => 'failed',
                        'error' => $message,
                        'message' => $message,
                        'auth_status' => $status['status'] ?? 'error',
                    ], 503);
                }

                return redirect()->back()->withErrors([
                    'document' => $message,
                ]);
            }

            $doc = $pipelineService->stageUpload($category, $file);
            $pipelineService->enqueue($doc, 'prepare');
            $doc->loadMissing('notebooklmDocument');

            Cache::forget("project.{$category->project_id}.categories");

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'document_id' => $doc->id,
                    'status' => $doc->analysis_status,
                    'pipeline_status' => $doc->notebooklmDocument?->sync_status ?? 'received',
                    'error' => null,
                ]);
            }

            return redirect()->back()->with('success', 'Documento cargado y enviado a NotebookLM.');
        }

        $fileName = time().'_'.$file->getClientOriginalName();

        // Estructura: ProjectName/CategoryName/filename.pdf
        $projectName = $category->project?->name ?? 'Sin Proyecto';
        $drivePath = $projectName.'/'.$category->name.'/'.$fileName;

        try {
            Storage::disk('google')->put($drivePath, $fileContent);

            $doc = $category->documents()->create([
                'name' => $file->getClientOriginalName(),
                'file_path' => $drivePath,
                'analysis_status' => 'pending',
                'analysis_data' => [
                    '_file' => [
                        'hash' => $duplicateService->fileHash($fileContent),
                        'original_name' => $file->getClientOriginalName(),
                    ],
                ],
                'analyzed_at' => null,
            ]);

            // Invalidar caché del proyecto para que el nuevo documento aparezca de inmediato
            Cache::forget("project.{$category->project_id}.categories");

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'document_id' => $doc->id,
                    'status' => $doc->fresh()->analysis_status,
                    'error' => null,
                ]);
            }

            return redirect()->back()->with('success', 'Documento subido con éxito.');
        } catch (\Exception $e) {
            \Log::error('Google Drive Document Upload Failed: '.$e->getMessage());

            if ($request->expectsJson()) {
                return response()->json(['errors' => ['document' => ['Error al subir a Google Drive.']]], 422);
            }

            return redirect()->back()->withErrors(['document' => 'Error al subir el documento a Google Drive.']);
        }
    }

    public function destroy(Request $request, Document $document)
    {
        $this->authorize('delete', $document);
        $this->deleteDocument($request, $document);

        // Invalidar caché del proyecto para que la UI se actualice correctamente
        $projectId = $document->category?->project_id;
        if ($projectId) {
            Cache::forget("project.{$projectId}.categories");
        }

        return redirect()->back()->with('success', 'Documento eliminado.');
    }

    public function bulkDestroy(Request $request, DocumentCategory $category)
    {
        $this->authorize('update', $category->project);

        $validated = $request->validate([
            'document_ids' => ['required', 'array', 'min:1'],
            'document_ids.*' => ['integer'],
        ]);

        $documentIds = collect($validated['document_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $documents = $category->documents()
            ->whereIn('id', $documentIds)
            ->with('category.project')
            ->get();

        foreach ($documents as $document) {
            $this->authorize('delete', $document);
            $this->deleteDocument($request, $document);
        }

        Cache::forget("project.{$category->project_id}.categories");

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'deleted' => $documents->count(),
            ]);
        }

        return redirect()->back()->with('success', 'Documentos eliminados.');
    }

    protected function deleteDocument(Request $request, Document $document): void
    {
        $document->loadMissing('category.project');

        DocumentDeletionLog::create([
            'deleted_by' => Auth::id(),
            'document_name' => $document->name,
            'file_path' => $document->file_path,
            'category_name' => $document->category?->name,
            'project_name' => $document->category?->project?->name,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        try {
            $isStaged = app(NotebookLMPipelineService::class)->isPipelineCategory($document->category?->name)
                && str_starts_with((string) $document->file_path, NotebookLMPipelineService::STAGING_PREFIX.'/');

            if ($isStaged) {
                Storage::disk('local')->delete($document->file_path);
            } else {
                Storage::disk('google')->delete($document->file_path);
            }
        } catch (\Exception $e) {
            \Log::warning('No se pudo eliminar el archivo del almacenamiento: '.$e->getMessage());
        }

        $document->delete();
    }
}
