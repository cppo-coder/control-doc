<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class NotebookLMSessionRenewalService
{
    public function __construct(
        protected NotebookLMSessionImportService $sessionImportService,
        protected NotebookLMAuthStatusService $authStatusService,
    ) {}

    public function renew(): array
    {
        $url = (string) config('notebooklm.renewal_worker_url');
        $token = (string) config('notebooklm.renewal_worker_token');
        $timeout = max(15, (int) config('notebooklm.renewal_worker_timeout_seconds', 90));
        $browser = (string) config('notebooklm.renewal_browser', 'chrome');

        if (blank($url)) {
            return [
                'success' => false,
                'message' => 'No hay worker de renovacion configurado.',
                'error' => 'Configura NOTEBOOKLM_RENEWAL_WORKER_URL para usar la renovacion automatica local.',
            ];
        }

        try {
            $request = Http::timeout($timeout)->acceptJson();

            if ($token !== '') {
                $request = $request->withToken($token);
            }

            $response = $request->post($url, [
                'browser' => $browser,
                'timeout_seconds' => $timeout,
            ]);
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'No fue posible contactar el worker local de NotebookLM.',
                'error' => $e->getMessage(),
            ];
        }

        if (! $response->successful()) {
            return [
                'success' => false,
                'message' => 'El worker local de NotebookLM devolvio un error.',
                'error' => $response->json('error')
                    ?? $response->json('message')
                    ?? $response->body(),
                'status_code' => $response->status(),
            ];
        }

        $capture = $response->json();

        if (! is_array($capture) || blank($capture['cookie_header'] ?? null)) {
            return [
                'success' => false,
                'message' => 'El worker local no devolvio una sesion utilizable.',
                'error' => 'Falta cookie_header en la respuesta del worker.',
            ];
        }

        $import = $this->sessionImportService->importSession(
            $capture['cookie_header'],
            $capture['request_url'] ?? null,
            $capture['request_body'] ?? null,
        );

        if (! ($import['success'] ?? false)) {
            return [
                'success' => false,
                'message' => 'Se capturo la sesion, pero no fue posible importarla.',
                'error' => $import['error'] ?? 'Importacion fallida.',
                'capture' => $capture,
            ];
        }

        $status = $this->authStatusService->status(fresh: true);

        return [
            'success' => (bool) ($status['ok'] ?? false),
            'message' => ($status['ok'] ?? false)
                ? 'Sesion de NotebookLM renovada automaticamente.'
                : 'Sesion capturada, pero NotebookLM todavia requiere validacion.',
            'capture' => $capture,
            'import' => $import,
            'notebooklm' => $status,
        ];
    }
}
