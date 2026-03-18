<?php

namespace App\Http\Controllers;

use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMSessionImportService;
use App\Services\NotebookLMSessionRenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotebookLMStatusController extends Controller
{
    public function show(Request $request, NotebookLMAuthStatusService $statusService): JsonResponse
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        $status = $statusService->status($request->boolean('fresh'));

        return response()->json([
            'success' => true,
            'notebooklm' => $status,
        ], ($status['ok'] ?? false) ? 200 : 503);
    }

    public function import(Request $request, NotebookLMSessionImportService $sessionImportService, NotebookLMAuthStatusService $statusService): JsonResponse
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        $validated = $request->validate([
            'cookie_header' => ['required', 'string', 'min:20'],
            'request_url' => ['nullable', 'string', 'min:10'],
            'request_body' => ['nullable', 'string', 'min:10'],
        ]);

        $result = $sessionImportService->importSession(
            $validated['cookie_header'],
            $validated['request_url'] ?? null,
            $validated['request_body'] ?? null,
        );

        if (! ($result['success'] ?? false)) {
            return response()->json([
                'success' => false,
                'message' => $result['error'] ?? 'No se pudo importar la sesión de NotebookLM.',
                'errors' => [
                    'cookie_header' => [$result['error'] ?? 'Cookie inválida.'],
                ],
                'missing' => $result['missing'] ?? [],
            ], 422);
        }

        $status = $statusService->status(fresh: true);

        return response()->json([
            'success' => true,
            'message' => ($status['ok'] ?? false)
                ? 'Sesión de NotebookLM importada y validada correctamente.'
                : 'Sesión importada, pero NotebookLM todavía requiere validación.',
            'import' => $result,
            'notebooklm' => $status,
        ], ($status['ok'] ?? false) ? 200 : 202);
    }

    public function renew(Request $request, NotebookLMSessionRenewalService $renewalService): JsonResponse
    {
        abort_unless($request->user()?->hasRole('admin'), 403);

        $result = $renewalService->renew();

        if (! ($result['success'] ?? false)) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'No fue posible renovar la sesión de NotebookLM.',
                'error' => $result['error'] ?? null,
                'notebooklm' => $result['notebooklm'] ?? null,
            ], 503);
        }

        return response()->json($result);
    }
}
