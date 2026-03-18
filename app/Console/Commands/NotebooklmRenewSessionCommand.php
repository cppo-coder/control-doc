<?php

namespace App\Console\Commands;

use App\Services\NotebookLMSessionRenewalService;
use Illuminate\Console\Command;

class NotebooklmRenewSessionCommand extends Command
{
    protected $signature = 'notebooklm:renew-session';

    protected $description = 'Solicita al worker local Playwright la renovacion automatica de la sesion de NotebookLM';

    public function handle(NotebookLMSessionRenewalService $renewalService): int
    {
        $this->info('Solicitando renovacion automatica de NotebookLM...');

        $result = $renewalService->renew();

        if (! ($result['success'] ?? false)) {
            $this->error($result['message'] ?? 'No fue posible renovar la sesion.');

            if (! empty($result['error'])) {
                $this->warn('Detalle: '.$result['error']);
            }

            return self::FAILURE;
        }

        $status = $result['notebooklm'] ?? [];

        $this->info($result['message'] ?? 'Sesion renovada.');
        $this->line('Estado: '.($status['status'] ?? 'unknown'));
        $this->line('Cuenta: '.($status['account_email'] ?? 'No configurada'));
        $this->line('Verificado: '.($status['checked_at'] ?? 'N/D'));

        return self::SUCCESS;
    }
}
