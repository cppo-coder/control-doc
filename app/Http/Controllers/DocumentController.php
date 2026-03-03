<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function store(Request $request, DocumentCategory $category)
    {
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

            if ($request->expectsJson()) {
                return response()->json(['success' => true, 'document_id' => $doc->id]);
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
    
    public function destroy(Document $document)
    {
        // optionally support document deletion
        try {
            Storage::disk('google')->delete($document->file_path);
        } catch (\Exception $e) {}
        
        $document->delete();
        return redirect()->back()->with('success', 'Documento eliminado.');
    }
}
