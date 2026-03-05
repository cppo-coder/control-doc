<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentDeletionLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function store(Request $request, DocumentCategory $category, \App\Services\DocumentAnalysisService $analysisService)
    {
        $this->authorize('update', $category->project);

        $request->validate([
            'document' => 'required|file|mimes:pdf|max:20480',
        ]);

        $file     = $request->file('document');
        $fileName = time() . '_' . $file->getClientOriginalName();

        // Estructura: ProjectName/CategoryName/filename.pdf
        $projectName  = $category->project?->name ?? 'Sin Proyecto';
        $drivePath    = $projectName . '/' . $category->name . '/' . $fileName;

        try {
            Storage::disk('google')->put($drivePath, file_get_contents($file->getRealPath()));

            $doc = $category->documents()->create([
                'name'      => $file->getClientOriginalName(),
                'file_path' => $drivePath,
            ]);

            // Invalidar caché del proyecto para que el nuevo documento aparezca de inmediato
            Cache::forget("project.{$category->project_id}.categories");

            if ($request->expectsJson()) {
                return response()->json([
                    'success'     => true,
                    'document_id' => $doc->id,
                    'status'      => $doc->fresh()->analysis_status,
                ]);
            }

            return redirect()->back()->with('success', 'Documento subido con éxito.');
        } catch (\Exception $e) {
            \Log::error('Google Drive Document Upload Failed: ' . $e->getMessage());

            if ($request->expectsJson()) {
                return response()->json(['errors' => ['document' => ['Error al subir a Google Drive.']]], 422);
            }

            return redirect()->back()->withErrors(['document' => 'Error al subir el documento a Google Drive.']);
        }
    }

    public function destroy(Request $request, Document $document)
    {
        $this->authorize('delete', $document);

        // Cargar relaciones para el log
        $document->loadMissing('category.project');

        // ── Registrar trazabilidad ──────────────────────────────────────────
        DocumentDeletionLog::create([
            'deleted_by'    => Auth::id(),
            'document_name' => $document->name,
            'file_path'     => $document->file_path,
            'category_name' => $document->category?->name,
            'project_name'  => $document->category?->project?->name,
            'ip_address'    => $request->ip(),
            'user_agent'    => $request->userAgent(),
        ]);

        // ── Eliminar de Google Drive y BD ───────────────────────────────────
        try {
            Storage::disk('google')->delete($document->file_path);
        } catch (\Exception $e) {
            \Log::warning('No se pudo eliminar de Drive: ' . $e->getMessage());
        }

        $document->delete();

        // Invalidar caché del proyecto para que la UI se actualice correctamente
        $projectId = $document->category?->project_id;
        if ($projectId) {
            Cache::forget("project.{$projectId}.categories");
        }

        return redirect()->back()->with('success', 'Documento eliminado.');
    }
}
