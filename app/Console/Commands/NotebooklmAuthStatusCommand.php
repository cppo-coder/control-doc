<?php

namespace App\Console\Commands;

use App\Services\NotebookLMAuthStatusService;
use Illuminate\Console\Command;

class NotebooklmAuthStatusCommand extends Command
{
    protected $signature = 'notebooklm:auth-status {--fresh : Omitir cache y consultar el estado real} {--json : Salida JSON}';

    protected $description = 'Verifica el estado de autenticacion/cookies de NotebookLM y si requiere renovacion';

    public function handle(NotebookLMAuthStatusService $statusService): int
    {
        $status = $statusService->status((bool) $this->option('fresh'));

        if ($this->option('json')) {
            $this->line(json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            return ($status['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
        }

        $this->info('NotebookLM auth status');
        $this->line('Estado: '.($status['status'] ?? 'unknown'));
        $this->line('Mensaje: '.($status['message'] ?? 'Sin mensaje'));
        $this->line('Cuenta: '.($status['account_email'] ?? 'No configurada'));
        $this->line('Runtime: '.($status['runtime_home'] ?? 'N/D'));
        $this->line('Cookies: '.($status['cookies_path'] ?? 'N/D'));

        if (! empty($status['validation_error'])) {
            $this->warn('Detalle: '.$status['validation_error']);
        }

        if (($status['renewal_required'] ?? false) === true) {
            $this->warn('Accion requerida: renovar la sesion ejecutando notebooklm-mcp-auth con la cuenta tecnica.');
        }

        return ($status['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
    }
}
