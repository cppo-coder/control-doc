<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Inertia\Inertia;

class ProjectController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            new Middleware('can:viewAny,App\Models\Project', only: ['index']),
            new Middleware('can:create,App\Models\Project', only: ['store']),
            new Middleware('can:delete,project', only: ['destroy']),
        ];
    }

    public function index()
    {
        $userId = auth()->id();

        // Caché por usuario — se invalida al crear/eliminar proyectos
        $projects = Cache::remember(
            "user.{$userId}.projects",
            now()->addMinutes(10),
            fn () => Project::select(['id', 'user_id', 'name', 'code', 'description', 'created_at'])
                ->where('user_id', $userId)
                ->withCount('categories')
                ->latest()
                ->get()
        );

        return Inertia::render('Projects/Index', compact('projects'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        Project::create([
            'user_id'     => auth()->id(),
            'name'        => $request->name,
            'code'        => $request->code,
            'description' => $request->description,
        ]);

        Cache::forget('user.' . auth()->id() . '.projects');

        return back();
    }

    public function destroy(Project $project)
    {
        $project->delete();

        Cache::forget('user.' . auth()->id() . '.projects');

        return back();
    }
}
