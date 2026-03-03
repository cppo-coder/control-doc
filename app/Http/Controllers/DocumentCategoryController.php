<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentCategoryController extends Controller
{
    public function index(Project $project)
    {
        abort_if($project->user_id !== auth()->id(), 403);

        $categories = $project->categories()->with('documents')->latest()->get();

        return Inertia::render('DocumentCategories/Index', [
            'project'    => $project,
            'categories' => $categories,
        ]);
    }

    public function store(Request $request, Project $project)
    {
        abort_if($project->user_id !== auth()->id(), 403);

        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $category = $project->categories()->create([
            'name' => $request->name,
        ]);

        // Create folder in Google Drive
        try {
            Storage::disk('google')->makeDirectory($project->name . '/' . $category->name);
        } catch (\Exception $e) {
            \Log::error('Google Drive Folder Creation Failed: ' . $e->getMessage());
        }

        return back();
    }

    public function update(Request $request, DocumentCategory $category)
    {
        abort_if($category->project->user_id !== auth()->id(), 403);

        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $category->update(['name' => $request->name]);

        return back();
    }
}
