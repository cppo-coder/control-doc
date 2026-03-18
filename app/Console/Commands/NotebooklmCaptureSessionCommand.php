<?php

namespace App\Console\Commands;

use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMSessionImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class NotebooklmCaptureSessionCommand extends Command
{
    protected $signature = 'notebooklm:capture-session
        {--browser=edge : Navegador a usar: edge o chrome}
        {--port=9222 : Puerto de depuracion remota}
        {--timeout=180 : Tiempo maximo de espera en segundos}
        {--profile= : Directorio del perfil dedicado para la captura}';

    protected $description = 'Abre un navegador con depuracion remota, captura la sesion de NotebookLM y la importa automaticamente';

    public function handle(
        NotebookLMSessionImportService $sessionImportService,
        NotebookLMAuthStatusService $statusService,
    ): int {
        $scriptPath = base_path('scripts/notebooklm-capture-session.mjs');

        if (! File::exists($scriptPath)) {
            $this->error('No se encontro el script de captura de NotebookLM.');

            return self::FAILURE;
        }

        $browser = strtolower((string) $this->option('browser'));
        $port = max(1000, (int) $this->option('port'));
        $timeout = max(30, (int) $this->option('timeout'));
        $profilePath = (string) ($this->option('profile') ?: storage_path('app/notebooklm-browser-profile'));
        $outputPath = storage_path('app/notebooklm-runtime/captured-session.json');

        File::ensureDirectoryExists(dirname($outputPath), 0700, true);
        File::ensureDirectoryExists($profilePath, 0700, true);
        File::delete($outputPath);

        $this->info('Captura asistida de NotebookLM');
        $this->line('Navegador: '.$browser);
        $this->line('Perfil: '.$profilePath);
        $this->line('Puerto CDP: '.$port);
        $this->newLine();
        $this->comment('Se abrira NotebookLM. Inicia sesion si hace falta y abre cualquier cuaderno.');
        $this->comment('El comando capturara automaticamente el primer request batchexecute valido y renovara la sesion.');
        $this->newLine();

        $process = new Process([
            'node',
            $scriptPath,
            '--browser', $browser,
            '--port', (string) $port,
            '--timeout', (string) $timeout,
            '--profile', $profilePath,
            '--output', $outputPath,
        ], base_path());

        $process->setTimeout($timeout + 30);
        $process->run(function (string $type, string $buffer): void {
            $stream = $type === Process::ERR ? $this->output->getErrorOutput() : $this->output;
            $stream->write($buffer);
        });

        if (! $process->isSuccessful()) {
            $this->newLine();
            $this->error('No fue posible capturar la sesion de NotebookLM.');

            return self::FAILURE;
        }

        if (! File::exists($outputPath)) {
            $this->newLine();
            $this->error('La captura termino sin generar datos de sesion.');

            return self::FAILURE;
        }

        $capture = json_decode(File::get($outputPath), true);

        if (! is_array($capture) || blank($capture['cookie_header'] ?? null)) {
            $this->newLine();
            $this->error('La captura no contiene un cookie header valido.');

            return self::FAILURE;
        }

        $import = $sessionImportService->importSession(
            $capture['cookie_header'],
            $capture['request_url'] ?? null,
            $capture['request_body'] ?? null,
        );

        if (! ($import['success'] ?? false)) {
            $this->newLine();
            $this->error($import['error'] ?? 'No se pudo importar la sesion capturada.');

            return self::FAILURE;
        }

        $status = $statusService->status(fresh: true);

        $this->newLine();
        $this->info('Sesion importada.');
        $this->line('Estado: '.($status['status'] ?? 'unknown'));
        $this->line('Mensaje: '.($status['message'] ?? 'Sin mensaje'));
        $this->line('Cuenta: '.($status['account_email'] ?? 'No configurada'));

        if (! empty($status['validation_error'])) {
            $this->warn('Detalle: '.$status['validation_error']);
        }

        return ($status['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
    }
}
