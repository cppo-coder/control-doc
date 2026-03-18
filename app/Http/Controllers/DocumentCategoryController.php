<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentCategoryController extends Controller
{
    public function index(Project $project)
    {
        $this->authorize('view', $project);
        $driver = DB::connection()->getDriverName();
        $hasNotebookTrackingColumns = Schema::hasColumns('notebook_l_m_documents', [
            'sync_status',
            'sync_error',
            'synced_at',
        ]);

        // Cache de categorías con documentos por 5 min (se invalida en store/update)
        $categories = Cache::remember(
            "project.{$project->id}.categories",
            now()->addMinutes(5),
            fn () => $project->categories()
                ->with([
                    'documents' => fn ($q) => $q
                        ->where(function ($documentQuery) use ($driver) {
                            $documentQuery
                                ->where('analysis_status', '!=', 'rejected')
                                ->orWhereNull('analysis_status')
                                ->orWhere(function ($analysisQuery) use ($driver) {
                                    if ($driver === 'pgsql') {
                                        $analysisQuery->whereRaw("(analysis_data::text NOT ILIKE '%no corresponde a la categoria%')");

                                        return;
                                    }

                                    $analysisQuery->where('analysis_data', 'not like', '%no corresponde a la categoria%');
                                });
                        })
                        ->select([
                            'id', 'document_category_id', 'name',
                            'analysis_status', 'analyzed_at', 'created_at', 'file_path',
                        ])->with([
                            'notebooklmDocument' => fn ($trackingQuery) => $trackingQuery->select(
                                $hasNotebookTrackingColumns
                                    ? ['id', 'document_id', 'source_id', 'sync_status', 'sync_error', 'synced_at']
                                    : ['id', 'document_id', 'source_id']
                            ),
                        ])->latest(),
                ])
                ->select(['id', 'project_id', 'name', 'sort_order', 'created_at'])
                ->orderBy('sort_order')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn (DocumentCategory $category) => [
                    'id' => $category->id,
                    'project_id' => $category->project_id,
                    'name' => $category->name,
                    'sort_order' => $category->sort_order,
                    'created_at' => $category->created_at,
                    'documents' => $category->documents->map(fn ($document) => [
                        'id' => $document->id,
                        'document_category_id' => $document->document_category_id,
                        'name' => $document->name,
                        'analysis_status' => $document->analysis_status,
                        'analysis_data' => $document->analysis_data,
                        'analyzed_at' => $document->analyzed_at,
                        'created_at' => $document->created_at,
                        'has_analysis_details' => ! is_null($document->analysis_status) || ($hasNotebookTrackingColumns && ! is_null($document->notebooklmDocument?->sync_error)),
                        'pipeline_status' => $hasNotebookTrackingColumns ? $document->notebooklmDocument?->sync_status : null,
                        'pipeline_error' => $hasNotebookTrackingColumns ? $document->notebooklmDocument?->sync_error : null,
                        'pipeline_source_id' => $document->notebooklmDocument?->source_id,
                    ])->values(),
                ])->values()
        );

        return Inertia::render('DocumentCategories/Index', [
            'project' => $project->only(['id', 'name', 'code', 'description']),
            'categories' => $categories,
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->authorize('update', $project);

        $maxOrder = $project->categories()->max('sort_order') ?? -1;
        $category = $project->categories()->create([
            'name' => $request->name,
            'sort_order' => $maxOrder + 1,
        ]);

        // Invalidar caché del proyecto
        Cache::forget("project.{$project->id}.categories");

        try {
            Storage::disk('google')->makeDirectory($project->name.'/'.$category->name);
        } catch (\Exception $e) {
            \Log::error('Google Drive Folder Creation Failed: '.$e->getMessage());
        }

        return back();
    }

    public function update(Request $request, DocumentCategory $category)
    {
        $this->authorize('update', $category->project);

        $request->validate(['name' => 'required|string|max:255']);

        $category->update(['name' => $request->name]);

        Cache::forget("project.{$category->project_id}.categories");

        return back();
    }

    public function destroy(DocumentCategory $category)
    {
        $this->authorize('update', $category->project);

        $category->loadMissing('project', 'documents.notebooklmDocument');

        DB::transaction(function () use ($category) {
            foreach ($category->documents as $document) {
                try {
                    $isStaged = app(\App\Services\NotebookLMPipelineService::class)->isPipelineCategory($category)
                        && str_starts_with((string) $document->file_path, \App\Services\NotebookLMPipelineService::STAGING_PREFIX.'/');

                    if ($isStaged) {
                        Storage::disk('local')->delete($document->file_path);
                    } else {
                        Storage::disk('google')->delete($document->file_path);
                    }
                } catch (\Throwable $e) {
                    \Log::warning('No se pudo eliminar el archivo al borrar carpeta: '.$e->getMessage(), [
                        'category_id' => $category->id,
                        'document_id' => $document->id,
                        'path' => $document->file_path,
                    ]);
                }
            }

            try {
                Storage::disk('google')->deleteDirectory($category->project->name.'/'.$category->name);
            } catch (\Throwable $e) {
                \Log::warning('No se pudo eliminar la carpeta en Google Drive: '.$e->getMessage(), [
                    'category_id' => $category->id,
                    'category_name' => $category->name,
                ]);
            }

            $category->delete();
        });

        Cache::forget("project.{$category->project_id}.categories");

        return back()->with('success', 'Carpeta eliminada correctamente.');
    }

    public function reorder(Request $request, Project $project)
    {
        $this->authorize('update', $project);

        $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|exists:document_categories,id',
            'categories.*.sort_order' => 'required|integer',
        ]);

        foreach ($request->categories as $item) {
            DocumentCategory::where('id', $item['id'])
                ->where('project_id', $project->id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        Cache::forget("project.{$project->id}.categories");

        return back()->with('success', 'Orden actualizado correctamente.');
    }
}
