<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Document;
use App\Models\Project;
use App\Models\Worker;
use App\Services\NotebookLMAuthStatusService;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(NotebookLMAuthStatusService $notebookLMAuthStatusService)
    {
        $user = auth()->user();
        $userId = $user?->id;
        $isAdmin = $user?->hasRole('admin') ?? false;

        // Caché de stats globales por 2 min — muy baratos de recalcular
        $stats = Cache::remember("dashboard.stats.{$userId}", now()->addMinutes(2), function () use ($userId) {
            return [
                'projects' => Project::where('user_id', $userId)->count(),
                'workers' => Worker::count(),
                'courses' => Course::count(),
                'documents' => Document::whereHas('category.project', function ($query) use ($userId) {
                    $query->where('user_id', $userId);
                })->count(),
            ];
        });

        // Proyectos recientes — caché de 5 min (ya cubierto por ProjectController)
        $recentProjects = Cache::remember("user.{$userId}.projects.recent", now()->addMinutes(5), fn () => Project::where('user_id', $userId)
            ->latest()
            ->take(5)
            ->get(['id', 'name', 'code', 'created_at'])
        );

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'recentProjects' => $recentProjects,
            'isAdmin' => $isAdmin,
            'notebooklmStatus' => $isAdmin ? $notebookLMAuthStatusService->status() : null,
        ]);
    }
}
