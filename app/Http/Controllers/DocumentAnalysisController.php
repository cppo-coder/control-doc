<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class DocumentAnalysisController extends Controller
{
    /**
     * Analiza el PDF de examen de salud con Gemini AI.
     */
    public function analyze(Document $document, \App\Services\DocumentAnalysisService $service)
    {
        $result = $service->analyze($document);

        // Refrescar el modelo desde la BD para obtener el status/data actualizado
        $document->refresh();

        // Invalidar caché del proyecto para que el reload del frontend reciba datos frescos
        $projectId = $document->category?->project_id;
        if ($projectId) {
            Cache::forget("project.{$projectId}.categories");
        }

        if (request()->wantsJson()) {
            return response()->json([
                'success' => $result['success'] ?? false,
                'status'  => $document->analysis_status,
                'data'    => $document->analysis_data,
                'error'   => $result['error'] ?? null,
            ]);
        }

        if (isset($result['error'])) {
            return back()->withErrors(['analysis' => $result['error']]);
        }

        return back();
    }
}
