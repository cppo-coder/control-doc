<?php

namespace Tests\Unit;

use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMSessionImportService;
use App\Services\NotebookLMSessionRenewalService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NotebookLMSessionRenewalServiceTest extends TestCase
{
    public function test_it_returns_configuration_error_when_worker_url_is_missing(): void
    {
        config()->set('notebooklm.renewal_worker_url', '');

        $service = new NotebookLMSessionRenewalService(
            app(NotebookLMSessionImportService::class),
            app(NotebookLMAuthStatusService::class),
        );

        $result = $service->renew();

        $this->assertFalse($result['success']);
        $this->assertSame('No hay worker de renovacion configurado.', $result['message']);
    }

    public function test_it_imports_and_validates_the_captured_session(): void
    {
        config()->set('notebooklm.renewal_worker_url', 'http://127.0.0.1:4318/capture');
        config()->set('notebooklm.renewal_worker_token', 'secret-token');
        config()->set('notebooklm.renewal_worker_timeout_seconds', 45);
        config()->set('notebooklm.renewal_browser', 'chrome');

        Http::fake([
            'http://127.0.0.1:4318/capture' => Http::response([
                'cookie_header' => 'SID=abc; HSID=def; SSID=ghi; APISID=jkl; SAPISID=mno;',
                'request_url' => 'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?f.sid=123',
                'request_body' => 'f.req=%5B%5D&at=test-token',
            ], 200),
        ]);

        $importer = new class(app(NotebookLMAuthStatusService::class)) extends NotebookLMSessionImportService
        {
            public function __construct($authStatusService)
            {
                parent::__construct($authStatusService);
            }

            public function importSession(string $cookieHeader, ?string $requestUrl = null, ?string $requestBody = null): array
            {
                return [
                    'success' => true,
                    'cookies_saved' => 5,
                    'csrf_token_detected' => true,
                    'session_id_detected' => true,
                ];
            }
        };

        $status = new class extends NotebookLMAuthStatusService
        {
            public function status(bool $fresh = false): array
            {
                return [
                    'status' => 'valid',
                    'ok' => true,
                    'message' => 'Sesion NotebookLM valida.',
                    'account_email' => 'semo.cppo@gmail.com',
                    'checked_at' => now()->toIso8601String(),
                ];
            }
        };

        $service = new NotebookLMSessionRenewalService($importer, $status);
        $result = $service->renew();

        $this->assertTrue($result['success']);
        $this->assertSame('valid', $result['notebooklm']['status']);
        Http::assertSentCount(1);
    }
}
