<?php

namespace Tests\Unit;

use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMSessionImportService;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class NotebookLMSessionImportServiceTest extends TestCase
{
    public function test_it_parses_and_saves_required_cookies(): void
    {
        $statusService = new class extends NotebookLMAuthStatusService
        {
            public function runtimeHome(): string
            {
                return storage_path('framework/testing/notebooklm-runtime');
            }
        };

        File::deleteDirectory($statusService->runtimeHome());

        $service = new NotebookLMSessionImportService($statusService);
        $result = $service->importSession(
            'cookie: SID=sid123; HSID=hsid123; SSID=ssid123; APISID=apisid123; SAPISID=sapisid123; __Secure-OSID=osid123',
            'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=abc&f.sid=2738196825762143049&hl=es',
            'f.req=%5B%5D&at=AFoagUVaToken123%3D&',
        );

        $this->assertTrue($result['success']);
        $this->assertFileExists($statusService->authCachePath());
        $this->assertFileExists($statusService->cookiesPath());

        $saved = json_decode(file_get_contents($statusService->authCachePath()), true);

        $this->assertSame('sid123', data_get($saved, 'cookies.SID'));
        $this->assertSame('osid123', data_get($saved, 'cookies.__Secure-OSID'));
        $this->assertSame('2738196825762143049', data_get($saved, 'session_id'));
        $this->assertSame('AFoagUVaToken123=', data_get($saved, 'csrf_token'));
        $this->assertTrue($result['csrf_token_detected']);
        $this->assertTrue($result['session_id_detected']);
    }

    public function test_it_rejects_missing_required_cookies(): void
    {
        $statusService = new class extends NotebookLMAuthStatusService
        {
            public function runtimeHome(): string
            {
                return storage_path('framework/testing/notebooklm-runtime-missing');
            }
        };

        File::deleteDirectory($statusService->runtimeHome());

        $service = new NotebookLMSessionImportService($statusService);
        $result = $service->importFromCookieHeader('SID=sid123; HSID=hsid123');

        $this->assertFalse($result['success']);
        $this->assertContains('SSID', $result['missing']);
        $this->assertContains('APISID', $result['missing']);
        $this->assertContains('SAPISID', $result['missing']);
    }

    public function test_it_extracts_session_and_csrf_tokens_from_request_payloads(): void
    {
        $service = new NotebookLMSessionImportService(new class extends NotebookLMAuthStatusService {});

        $this->assertSame(
            '123456789',
            $service->extractSessionId('https://example.test/path?f.sid=123456789&hl=es')
        );

        $this->assertSame(
            'token-value=',
            $service->extractCsrfToken('f.req=%5B%5D&at=token-value%3D&')
        );
    }
}
