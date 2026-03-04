<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class DocumentAnalysisController extends Controller
{
    /**
     * Analiza el PDF de examen de salud con Gemini AI.
     */
    public function analyze(Document $document, \App\Services\DocumentAnalysisService $service)
    {
        $result = $service->analyze($document);

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
