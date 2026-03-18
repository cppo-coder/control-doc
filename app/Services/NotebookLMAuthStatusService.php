<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class NotebookLMAuthStatusService
{
    public function status(bool $fresh = false): array
    {
        $ttl = max(0, (int) config('notebooklm.status_cache_seconds', 60));

        if ($fresh || $ttl === 0) {
            return $this->resolveStatus();
        }

        return Cache::remember(
            'notebooklm.auth_status',
            now()->addSeconds($ttl),
            fn () => $this->resolveStatus()
        );
    }

    public function resolveStatus(): array
    {
        $runtimeHome = $this->runtimeHome();
        $configHome = $this->configHome();
        $cookiesPath = $this->cookiesPath();
        $authCachePath = $this->authCachePath();
        $python = $this->pythonBinary();

        $baseStatus = [
            'account_email' => config('notebooklm.account_email'),
            'runtime_home' => $runtimeHome,
            'config_home' => $configHome,
            'cookies_path' => $cookiesPath,
            'auth_cache_path' => $authCachePath,
            'python_bin' => $python,
            'checked_at' => now()->toIso8601String(),
        ];

        if (! is_file($python)) {
            return array_merge($baseStatus, [
                'status' => 'missing_binary',
                'ok' => false,
                'message' => 'No se encontro el binario de NotebookLM MCP.',
                'renewal_required' => false,
                'validation_error' => 'NOTEBOOKLM_PYTHON_BIN no existe o no es accesible.',
            ]);
        }

        if (! is_file($authCachePath) && ! is_file($cookiesPath)) {
            return array_merge($baseStatus, [
                'status' => 'missing_cookie',
                'ok' => false,
                'message' => 'No existe una sesion autenticada de NotebookLM.',
                'renewal_required' => true,
                'validation_error' => 'No se encontro auth.json/cookies.json. Ejecuta notebooklm-mcp-auth con la cuenta tecnica.',
            ]);
        }

        $script = <<<'PY'
import json
from notebooklm_mcp.auth import load_cached_tokens
from notebooklm_mcp.api_client import NotebookLMClient

tokens = load_cached_tokens()
if not tokens:
    print(json.dumps({
        "status": "missing_cookie",
        "ok": False,
        "message": "No se encontro una sesion activa de NotebookLM.",
        "renewal_required": True,
        "validation_error": "load_cached_tokens() no devolvio tokens."
    }))
    raise SystemExit(0)

try:
    client = NotebookLMClient(
        cookies=tokens.cookies,
        csrf_token=tokens.csrf_token,
        session_id=tokens.session_id,
    )
    notebooks = client.list_notebooks()
    print(json.dumps({
        "status": "valid",
        "ok": True,
        "message": "Sesion NotebookLM valida.",
        "renewal_required": False,
        "notebook_count": len(notebooks),
    }))
except Exception as exc:
    message = str(exc)
    lowered = message.lower()
    expired = any(term in lowered for term in [
        "401",
        "403",
        "unauth",
        "forbidden",
        "expired",
        "csrf",
        "login",
        "session",
        "cookie",
    ])
    print(json.dumps({
        "status": "expired" if expired else "validation_error",
        "ok": False,
        "message": "La sesion de NotebookLM requiere renovacion." if expired else "NotebookLM devolvio un error de validacion.",
        "renewal_required": expired,
        "validation_error": message,
    }))
PY;

        $process = new Process([$python, '-c', $script], null, $this->pythonEnvironment());
        $process->setTimeout(90);
        $process->run();

        if (! $process->isSuccessful()) {
            return array_merge($baseStatus, [
                'status' => 'error',
                'ok' => false,
                'message' => 'No fue posible validar la sesion de NotebookLM.',
                'renewal_required' => false,
                'validation_error' => trim($process->getErrorOutput()) !== '' ? trim($process->getErrorOutput()) : trim($process->getOutput()),
            ]);
        }

        $decoded = json_decode(trim($process->getOutput()), true);
        if (! is_array($decoded)) {
            return array_merge($baseStatus, [
                'status' => 'error',
                'ok' => false,
                'message' => 'NotebookLM devolvio una respuesta invalida al validar la sesion.',
                'renewal_required' => false,
                'validation_error' => trim($process->getOutput()),
            ]);
        }

        return array_merge($baseStatus, $decoded);
    }

    public function invalidateCache(): void
    {
        Cache::forget('notebooklm.auth_status');
    }

    public function runtimeHome(): string
    {
        return rtrim((string) config('notebooklm.runtime_home', storage_path('app/notebooklm-runtime')), '/');
    }

    public function configHome(): string
    {
        return $this->runtimeHome().'/.config';
    }

    public function cookiesPath(): string
    {
        return $this->configHome().'/notebooklm-mcp/cookies.json';
    }

    public function authCachePath(): string
    {
        return $this->runtimeHome().'/.notebooklm-mcp/auth.json';
    }

    public function pythonBinary(): string
    {
        $configured = config('notebooklm.python_bin');
        if (is_string($configured) && trim($configured) !== '') {
            return $configured;
        }

        return $this->resolveUserHome().'/.local/share/uv/tools/notebooklm-mcp-server/bin/python';
    }

    public function pythonEnvironment(): array
    {
        $runtimeHome = $this->runtimeHome();
        $configHome = $this->configHome();

        if (! File::exists($configHome)) {
            File::ensureDirectoryExists($configHome, 0700, true);
        }

        return [
            'HOME' => $runtimeHome,
            'XDG_CONFIG_HOME' => $configHome,
        ];
    }

    protected function resolveUserHome(): string
    {
        $candidates = [
            env('HOME'),
            getenv('HOME') ?: null,
            $_SERVER['HOME'] ?? null,
            $_ENV['HOME'] ?? null,
            $_SERVER['USERPROFILE'] ?? null,
            $_ENV['USERPROFILE'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return rtrim($candidate, '/');
            }
        }

        if (function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
            $userInfo = posix_getpwuid(posix_geteuid());
            if (is_array($userInfo) && ! empty($userInfo['dir'])) {
                return rtrim((string) $userInfo['dir'], '/');
            }
        }

        return '/Users/beagle';
    }
}
