<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function index()
    {
        $projects = Project::where('user_id', auth()->id())
            ->withCount('categories')
            ->latest()
            ->get();

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        Project::create([
            'user_id'     => auth()->id(),
            'name'        => $request->name,
            'code'        => $request->code,
            'description' => $request->description,
        ]);

        return back();
    }

    public function destroy(Project $project)
    {
        abort_if($project->user_id !== auth()->id(), 403);
        $project->delete();
        return back();
    }
}
