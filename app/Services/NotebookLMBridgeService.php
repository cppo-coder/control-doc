<?php

namespace App\Services;

use App\Models\DocumentCategory;
use App\Models\NotebookLMConfig;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class NotebookLMBridgeService
{
    public function __construct(
        protected NotebookLMAuthStatusService $authStatusService,
    ) {}

    public function ensureNotebookForCategory(DocumentCategory $category): ?NotebookLMConfig
    {
        $title = $this->resolveNotebookTitle($category->name);
        $config = NotebookLMConfig::query()
            ->where('document_category_id', $category->id)
            ->first();

        $authStatus = $this->authStatusService->status(fresh: true);
        if (($authStatus['status'] ?? null) !== 'valid') {
            if ($config) {
                if ($config->notebook_title !== $title) {
                    $config->update([
                        'notebook_title' => $title,
                    ]);
                }

                return $config->fresh();
            }

            return NotebookLMConfig::query()->updateOrCreate(
                ['document_category_id' => $category->id],
                [
                    'notebook_id' => $this->placeholderNotebookId($category),
                    'notebook_title' => $title,
                ]
            );
        }

        $existing = $this->findNotebookByTitle($title);
        if ($existing['id'] ?? null) {
            return NotebookLMConfig::query()->updateOrCreate(
                ['document_category_id' => $category->id],
                [
                    'notebook_id' => $existing['id'],
                    'notebook_title' => $title,
                ]
            );
        }

        $created = $this->createNotebook($title);
        if ($created['id'] ?? null) {
            return NotebookLMConfig::query()->updateOrCreate(
                ['document_category_id' => $category->id],
                [
                    'notebook_id' => $created['id'],
                    'notebook_title' => $title,
                ]
            );
        }

        if ($config) {
            if ($config->notebook_title !== $title) {
                $config->update([
                    'notebook_title' => $title,
                ]);
            }

            return $config->fresh();
        }

        return NotebookLMConfig::query()->updateOrCreate(
            ['document_category_id' => $category->id],
            [
                'notebook_id' => $this->placeholderNotebookId($category),
                'notebook_title' => $title,
            ]
        );
    }

    public function ensureNotebookForBatch(DocumentCategory $category, string $batchId): array
    {
        $cacheKey = 'notebooklm:batch_notebook:'.$batchId;

        return Cache::rememberForever($cacheKey, function () use ($category, $batchId) {
            $title = $this->resolveBatchNotebookTitle($category->name, $batchId);
            $authStatus = $this->authStatusService->status(fresh: true);

            if (($authStatus['status'] ?? null) !== 'valid') {
                return [
                    'notebook_id' => $this->placeholderNotebookIdForBatch($category, $batchId),
                    'notebook_title' => $title,
                    'batch_id' => $batchId,
                ];
            }

            $created = $this->createNotebook($title);

            if ($created['id'] ?? null) {
                return [
                    'notebook_id' => $created['id'],
                    'notebook_title' => $created['title'] ?? $title,
                    'batch_id' => $batchId,
                ];
            }

            return [
                'notebook_id' => $this->placeholderNotebookIdForBatch($category, $batchId),
                'notebook_title' => $title,
                'batch_id' => $batchId,
            ];
        });
    }

    public function addTextSource(string $notebookId, string $title, string $text): ?array
    {
        return $this->runAction('add_text_source', [
            'notebook_id' => $notebookId,
            'title' => $title,
            'text' => $text,
        ]);
    }

    public function addDriveSource(string $notebookId, string $documentId, string $title, string $docType = 'pdf'): ?array
    {
        return $this->runAction('add_drive_source', [
            'notebook_id' => $notebookId,
            'document_id' => $documentId,
            'title' => $title,
            'doc_type' => $docType,
        ]);
    }

    public function getSourceFulltext(string $sourceId): ?array
    {
        return $this->runAction('get_source_fulltext', [
            'source_id' => $sourceId,
        ]);
    }

    protected function findNotebookByTitle(string $title): ?array
    {
        $result = $this->runAction('find_notebook_by_title', ['title' => $title]);

        return is_array($result) ? $result : null;
    }

    protected function createNotebook(string $title): ?array
    {
        $result = $this->runAction('create_notebook', ['title' => $title]);

        return is_array($result) ? $result : null;
    }

    protected function runAction(string $action, array $payload): ?array
    {
        $authStatus = $this->authStatusService->status(fresh: true);
        $python = $this->authStatusService->pythonBinary();

        if (($authStatus['status'] ?? null) !== 'valid') {
            $error = $authStatus['validation_error'] ?? $authStatus['message'] ?? 'NotebookLM no autenticado.';
            Log::warning('[NOTEBOOKLM BRIDGE] Autenticacion no disponible para ejecutar accion', [
                'action' => $action,
                'auth_status' => $authStatus['status'] ?? 'error',
                'error' => $error,
                'python_bin' => $python,
                'status' => $authStatus,
            ]);

            return [
                'status' => 'error',
                'error' => $error,
                'auth_status' => $authStatus['status'] ?? 'error',
                'renewal_required' => (bool) ($authStatus['renewal_required'] ?? false),
            ];
        }

        $script = <<<'PY'
import json
import sys
from notebooklm_mcp.auth import load_cached_tokens
from notebooklm_mcp.api_client import NotebookLMClient

action = sys.argv[1]
payload = json.loads(sys.argv[2])

tokens = load_cached_tokens()
if not tokens:
    print(json.dumps({"status": "error", "error": "NotebookLM no autenticado. Ejecuta notebooklm-mcp-auth."}))
    sys.exit(0)

client = NotebookLMClient(
    cookies=tokens.cookies,
    csrf_token=tokens.csrf_token,
    session_id=tokens.session_id,
)

if action == "find_notebook_by_title":
    title = payload["title"]
    for notebook in client.list_notebooks():
        if notebook.title.strip().lower() == title.strip().lower():
            print(json.dumps({"status": "success", "id": notebook.id, "title": notebook.title}))
            sys.exit(0)
    print(json.dumps({"status": "missing"}))
elif action == "create_notebook":
    notebook = client.create_notebook(payload["title"])
    if notebook:
        print(json.dumps({"status": "success", "id": notebook.id, "title": notebook.title}))
    else:
        print(json.dumps({"status": "error", "error": "No se pudo crear el cuaderno"}))
elif action == "add_text_source":
    result = client.add_text_source(payload["notebook_id"], payload["text"], payload["title"])
    print(json.dumps(result or {"status": "error", "error": "No se pudo crear el source"}))
elif action == "add_drive_source":
    result = client.add_drive_source(
        payload["notebook_id"],
        document_id=payload["document_id"],
        title=payload["title"],
        mime_type="application/pdf" if payload.get("doc_type", "pdf") == "pdf" else payload.get("doc_type"),
    )
    print(json.dumps(result or {"status": "error", "error": "No se pudo crear el source desde Drive"}))
elif action == "get_source_fulltext":
    result = client.get_source_fulltext(payload["source_id"])
    print(json.dumps(result or {"status": "error", "error": "No se pudo leer el source"}))
else:
    print(json.dumps({"status": "error", "error": f"Accion no soportada: {action}"}))
PY;

        $process = new Process(
            [$python, '-c', $script, $action, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)],
            null,
            $this->authStatusService->pythonEnvironment()
        );
        $process->setTimeout(180);
        $process->run();

        if (! $process->isSuccessful()) {
            Log::warning('[NOTEBOOKLM BRIDGE] Proceso Python falló', [
                'action' => $action,
                'error' => $process->getErrorOutput(),
                'output' => $process->getOutput(),
            ]);

            return null;
        }

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded) || ($decoded['status'] ?? null) === 'error') {
            Log::warning('[NOTEBOOKLM BRIDGE] Respuesta inválida', [
                'action' => $action,
                'response' => $process->getOutput(),
            ]);

            return $decoded;
        }

        return $decoded;
    }

    protected function resolveNotebookTitle(?string $categoryName): string
    {
        $normalized = str((string) $categoryName)->lower()->ascii()->value();

        if (str_contains($normalized, 'contrato') || str_contains($normalized, 'anexo')) {
            return 'Contratos y Anexos (Auto DB)';
        }

        if (str_contains($normalized, 'examen')) {
            return 'Examenes (Auto DB)';
        }

        return trim((string) $categoryName) !== '' ? trim((string) $categoryName) : 'Documentos (Auto DB)';
    }

    protected function resolveBatchNotebookTitle(?string $categoryName, string $batchId): string
    {
        return $this->resolveNotebookTitle($categoryName).' · Lote '.str($batchId)->afterLast('-')->limit(8, '')->value();
    }

    protected function placeholderNotebookId(DocumentCategory $category): string
    {
        return 'pending_category_'.$category->id;
    }

    protected function placeholderNotebookIdForBatch(DocumentCategory $category, string $batchId): string
    {
        return 'pending_category_'.$category->id.'_batch_'.$batchId;
    }

    protected function isPlaceholderNotebookId(?string $notebookId): bool
    {
        return filled($notebookId) && str_starts_with($notebookId, 'pending_category_');
    }
}
