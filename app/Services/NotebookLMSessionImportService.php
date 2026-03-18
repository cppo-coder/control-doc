<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class NotebookLMSessionImportService
{
    private const REQUIRED_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];

    public function __construct(
        protected NotebookLMAuthStatusService $authStatusService,
    ) {}

    public function importSession(string $cookieHeader, ?string $requestUrl = null, ?string $requestBody = null): array
    {
        $cookies = $this->parseCookieHeader($cookieHeader);

        if ($cookies === []) {
            return [
                'success' => false,
                'error' => 'No se pudo parsear la cookie. Pega solo el valor completo del header cookie.',
                'missing' => self::REQUIRED_COOKIES,
            ];
        }

        $missing = collect(self::REQUIRED_COOKIES)
            ->reject(fn (string $key) => array_key_exists($key, $cookies))
            ->values()
            ->all();

        if ($missing !== []) {
            return [
                'success' => false,
                'error' => 'Faltan cookies obligatorias para NotebookLM.',
                'missing' => $missing,
            ];
        }

        $runtimeHome = $this->authStatusService->runtimeHome();
        $cachePath = $this->authStatusService->authCachePath();
        $configDir = dirname($this->authStatusService->cookiesPath());

        File::ensureDirectoryExists($runtimeHome, 0700, true);
        File::ensureDirectoryExists(dirname($cachePath), 0700, true);
        File::ensureDirectoryExists($configDir, 0700, true);

        File::put($cachePath, json_encode([
            'cookies' => $cookies,
            'csrf_token' => $this->extractCsrfToken($requestBody, $requestUrl),
            'session_id' => $this->extractSessionId($requestUrl, $requestBody),
            'extracted_at' => time(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        // Compatibilidad con el estado histórico del proyecto.
        File::put($this->authStatusService->cookiesPath(), json_encode($cookies, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->authStatusService->invalidateCache();

        return [
            'success' => true,
            'cookies_saved' => count($cookies),
            'csrf_token_detected' => $this->extractCsrfToken($requestBody, $requestUrl) !== null,
            'session_id_detected' => $this->extractSessionId($requestUrl, $requestBody) !== null,
            'runtime_home' => $runtimeHome,
            'cache_path' => $cachePath,
        ];
    }

    public function importFromCookieHeader(string $cookieHeader): array
    {
        return $this->importSession($cookieHeader);
    }

    public function parseCookieHeader(string $cookieHeader): array
    {
        $normalized = trim($cookieHeader);
        $normalized = preg_replace('/^\s*cookie:\s*/i', '', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        if ($normalized === '') {
            return [];
        }

        $cookies = [];

        foreach (explode(';', $normalized) as $segment) {
            $segment = trim($segment);

            if ($segment === '' || ! str_contains($segment, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $segment, 2);
            $key = trim($key);
            $value = trim($value);

            if ($key === '' || $value === '') {
                continue;
            }

            if (! Str::contains($key, ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'OSID', 'AEC', 'NID', '__Secure-'])) {
                continue;
            }

            $cookies[$key] = $value;
        }

        return $cookies;
    }

    public function extractSessionId(?string $requestUrl, ?string $requestBody = null): ?string
    {
        foreach ([$requestUrl, $requestBody] as $source) {
            if (! is_string($source) || trim($source) === '') {
                continue;
            }

            if (preg_match('/(?:^|[?&\s])f\.sid=([^&\s]+)/', $source, $matches) === 1) {
                return urldecode($matches[1]);
            }
        }

        return null;
    }

    public function extractCsrfToken(?string $requestBody, ?string $requestUrl = null): ?string
    {
        foreach ([$requestBody, $requestUrl] as $source) {
            if (! is_string($source) || trim($source) === '') {
                continue;
            }

            if (preg_match('/(?:^|[?&\s])at=([^&\s]+)/', $source, $matches) === 1) {
                return urldecode($matches[1]);
            }
        }

        return null;
    }
}
