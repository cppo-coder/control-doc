<?php

namespace App\Http\Controllers;

use App\Services\AiLoadBalancerService;
use App\Services\NotebookLMAuthStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminAiStatusController extends Controller
{
    public function index(Request $request, NotebookLMAuthStatusService $notebookLMStatusService, AiLoadBalancerService $aiLoadBalancerService): Response
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        return Inertia::render('Admin/AiStatus', [
            'notebooklmStatus' => $notebookLMStatusService->status(),
            'aiBalancerStatus' => $aiLoadBalancerService->status(),
        ]);
    }

    public function refresh(Request $request, NotebookLMAuthStatusService $notebookLMStatusService, AiLoadBalancerService $aiLoadBalancerService): JsonResponse
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        $notebookStatus = $notebookLMStatusService->status($request->boolean('fresh', true));

        return response()->json([
            'success' => true,
            'notebooklm' => $notebookStatus,
            'ai_balancer' => $aiLoadBalancerService->status(),
        ], ($notebookStatus['ok'] ?? false) ? 200 : 503);
    }

    public function updateRoute(Request $request, AiLoadBalancerService $aiLoadBalancerService): JsonResponse
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        $validated = $request->validate([
            'id' => ['required', 'string', 'max:255'],
            'enabled' => ['nullable', 'boolean'],
            'model' => ['nullable', 'string', 'max:255'],
            'weight' => ['nullable', 'integer', 'min:1'],
        ]);

        $status = $aiLoadBalancerService->updateRoute($validated['id'], $validated);

        return response()->json([
            'success' => true,
            'ai_balancer' => $status,
        ]);
    }
}
