<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMPipelineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DocumentAnalysisController extends Controller
{
    /**
     * Encola el documento para el pipeline NotebookLM -> Gemini -> Drive.
     */
    public function analyze(Document $document, NotebookLMPipelineService $pipelineService, NotebookLMAuthStatusService $notebookLMAuthStatusService)
    {
        set_time_limit(300);

        $this->authorize('update', $document->category->project);

        if ($pipelineService->isPipelineCategory($document->category)) {
            $status = $notebookLMAuthStatusService->status(fresh: true);
            if (($status['ok'] ?? false) !== true) {
                $message = $status['validation_error'] ?? $status['message'] ?? 'NotebookLM no esta disponible.';

                if (request()->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'queued' => false,
                        'status' => 'error',
                        'error' => $message,
                        'message' => $message,
                        'auth_status' => $status['status'] ?? 'error',
                    ], 503);
                }

                return back()->with('error', $message);
            }

            $document->loadMissing('notebooklmDocument');
            $syncStatus = $document->notebooklmDocument?->sync_status;

            if ($syncStatus !== 'ready_for_query') {
                $message = 'El documento aun no esta listo en NotebookLM. Espera a que el lote complete la preparacion antes de analizar.';

                if (request()->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'queued' => false,
                        'status' => 'pending',
                        'error' => $message,
                        'message' => $message,
                        'pipeline_status' => $syncStatus,
                    ], 409);
                }

                return back()->with('error', $message);
            }
        }

        $currentData = is_array($document->analysis_data) ? $document->analysis_data : [];
        unset($currentData['error']);

        $document->update([
            'analysis_status' => 'pending',
            'analysis_data' => $currentData,
        ]);

        $pipelineService->enqueue($document, 'analyze');

        $projectId = $document->category?->project_id;
        if ($projectId) {
            Cache::forget("project.{$projectId}.categories");
        }

        if (request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'queued' => true,
                'status' => 'pending',
                'data' => $document->fresh()->analysis_data,
                'error' => null,
            ]);
        }

        return back()->with('success', 'Documento encolado para procesamiento.');
    }

    public function bulkAnalyze(Request $request, DocumentCategory $category, NotebookLMPipelineService $pipelineService, NotebookLMAuthStatusService $notebookLMAuthStatusService)
    {
        set_time_limit(300);

        $this->authorize('update', $category->project);

        if ($pipelineService->isPipelineCategory($category)) {
            $status = $notebookLMAuthStatusService->status(fresh: true);
            if (($status['ok'] ?? false) !== true) {
                $message = $status['validation_error'] ?? $status['message'] ?? 'NotebookLM no esta disponible.';

                if (request()->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'queued' => 0,
                        'results' => [],
                        'error' => $message,
                        'message' => $message,
                        'auth_status' => $status['status'] ?? 'error',
                    ], 503);
                }

                return back()->with('error', $message);
            }
        }

        $documentIds = collect($request->input('document_ids', []))
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $documents = $category->documents()
            ->when($documentIds->isNotEmpty(), fn ($query) => $query->whereIn('id', $documentIds))
            ->where(function ($query) {
                $query->whereNull('analysis_status')
                    ->orWhereIn('analysis_status', ['pending', 'error']);
            })
            ->when(
                $pipelineService->isPipelineCategory($category),
                fn ($query) => $query->whereHas('notebooklmDocument', fn ($trackingQuery) => $trackingQuery->where('sync_status', 'ready_for_query'))
            )
            ->get();

        foreach ($documents as $document) {
            $currentData = is_array($document->analysis_data) ? $document->analysis_data : [];
            unset($currentData['error']);

            $document->update([
                'analysis_status' => 'pending',
                'analysis_data' => $currentData,
            ]);

            $pipelineService->enqueue($document, 'analyze');
        }

        Cache::forget("project.{$category->project_id}.categories");

        if (request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'queued' => $documents->count(),
                'results' => $documents->map(fn (Document $document) => [
                    'document_id' => $document->id,
                    'name' => $document->name,
                    'success' => true,
                    'status' => 'queued',
                    'error' => null,
                ])->values(),
            ]);
        }

        return back()->with('success', 'Analisis masivo encolado correctamente.');
    }
}
