<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentCategory;
use Illuminate\Support\Facades\Storage;

class DocumentDuplicateService
{
    public function findDuplicate(DocumentCategory $category, string $fileContent): ?Document
    {
        $targetHash = md5($fileContent);

        $indexedDuplicate = $category->documents()
            ->latest('id')
            ->where('analysis_data', 'like', '%"hash":"'.$targetHash.'"%')
            ->get(['id', 'document_category_id', 'name', 'file_path', 'analysis_data'])
            ->first(fn (Document $document) => ! $this->isCategoryMismatchRejection($document));

        if ($indexedDuplicate) {
            return $indexedDuplicate;
        }

        $documents = $category->documents()
            ->latest('id')
            ->get(['id', 'document_category_id', 'name', 'file_path', 'analysis_data']);

        foreach ($documents as $document) {
            if ($this->isCategoryMismatchRejection($document)) {
                continue;
            }

            $existingHash = data_get($document->analysis_data, '_file.hash');

            if (! $existingHash) {
                $existingHash = $this->hashStoredFile($document->file_path);
            }

            if ($existingHash && hash_equals($existingHash, $targetHash)) {
                return $document;
            }
        }

        return null;
    }

    public function fileHash(string $fileContent): string
    {
        return md5($fileContent);
    }

    protected function hashStoredFile(?string $path): ?string
    {
        if (! filled($path)) {
            return null;
        }

        try {
            $content = str_starts_with($path, NotebookLMPipelineService::STAGING_PREFIX.'/')
                ? Storage::disk('local')->get($path)
                : Storage::disk('google')->get($path);

            return md5($content);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function isCategoryMismatchRejection(Document $document): bool
    {
        if ($document->analysis_status !== 'rejected') {
            return false;
        }

        $reason = str((string) (data_get($document->analysis_data, 'motivo_rechazo') ?? data_get($document->analysis_data, 'resumen')))
            ->lower()
            ->ascii()
            ->value();

        return str_contains($reason, 'no corresponde a la categoria');
    }
}
