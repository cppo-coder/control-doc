<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class EncryptWorkerFields extends Command
{
    protected $signature = 'workers:encrypt-fields';

    protected $description = 'Cifra en reposo los campos bancarios de workers que aún están en texto plano.';

    /** Campos que se van a cifrar */
    private array $fields = [
        'cta_bancaria',
        'beneficiario_cta_abono',
        'beneficiario_swift',
    ];

    public function handle(): int
    {
        $rows = DB::table('workers')->select(['id', ...$this->fields])->get();

        if ($rows->isEmpty()) {
            $this->info('No hay registros de workers. Nada que hacer.');

            return self::SUCCESS;
        }

        $this->info("Procesando {$rows->count()} registro(s)...");
        $bar = $this->output->createProgressBar($rows->count());
        $bar->start();

        $encrypted = 0;
        $skipped = 0;

        foreach ($rows as $row) {
            $update = [];

            foreach ($this->fields as $field) {
                $raw = $row->$field;

                if ($raw === null || $raw === '') {
                    // Nada que cifrar
                    continue;
                }

                // Detectar si ya está cifrado (empieza con eyJ = base64 de JSON de Laravel)
                if ($this->isAlreadyEncrypted($raw)) {
                    $skipped++;

                    continue;
                }

                $update[$field] = Crypt::encryptString($raw);
            }

            if (! empty($update)) {
                DB::table('workers')->where('id', $row->id)->update($update);
                $encrypted++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('✅ Cifrado completado:');
        $this->line("   Registros procesados : {$rows->count()}");
        $this->line("   Campos cifrados       : {$encrypted}");
        $this->line("   Ya cifrados (omitidos): {$skipped}");
        $this->newLine();
        $this->warn('Ahora activa los casts encrypted en el modelo Worker.');

        return self::SUCCESS;
    }

    /**
     * Detecta si un valor ya fue cifrado por Laravel Crypt::encryptString().
     * El payload cifrado es un JSON en base64 que contiene las claves "iv", "value" y "mac".
     */
    private function isAlreadyEncrypted(string $value): bool
    {
        try {
            $decoded = json_decode(base64_decode($value), true);

            return isset($decoded['iv'], $decoded['value'], $decoded['mac']);
        } catch (\Throwable) {
            return false;
        }
    }
}
