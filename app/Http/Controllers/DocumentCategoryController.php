<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentCategoryController extends Controller
{
    public function index(Project $project)
    {
        $this->authorize('view', $project);

        // Cache de categorías con documentos por 5 min (se invalida en store/update)
        $categories = Cache::remember(
            "project.{$project->id}.categories",
            now()->addMinutes(5),
            fn () => $project->categories()
                ->with([
                    'documents' => fn ($q) => $q->select([
                        'id', 'document_category_id', 'name',
                        'analysis_status', 'analysis_data', 'analyzed_at', 'created_at',
                    ])->latest()
                ])
                ->select(['id', 'project_id', 'name', 'created_at'])
                ->latest()
                ->get()
        );

        return Inertia::render('DocumentCategories/Index', [
            'project'    => $project->only(['id', 'name', 'code', 'description']),
            'categories' => $categories,
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->authorize('update', $project);

        $request->validate(['name' => 'required|string|max:255']);

        $category = $project->categories()->create(['name' => $request->name]);

        // Invalidar caché del proyecto
        Cache::forget("project.{$project->id}.categories");

        try {
            Storage::disk('google')->makeDirectory($project->name . '/' . $category->name);
        } catch (\Exception $e) {
            \Log::error('Google Drive Folder Creation Failed: ' . $e->getMessage());
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
}
