<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class EncryptSensitiveFields extends Command
{
    protected $signature = 'app:encrypt-sensitive-fields {--dry-run : Solo muestra qué cambiaria sin modificar la BD}';

    protected $description = 'Detecta y cifra campos sensibles en texto plano en todas las tablas configuradas.';

    /**
     * Mapa de tablas → campos a cifrar.
     * 'type' puede ser:
     *   - 'string'  → Crypt::encryptString / decryptString
     *   - 'array'   → json_encode luego Crypt::encrypt (para cast encrypted:array)
     */
    private array $map = [
        'workers' => [
            ['field' => 'cta_bancaria',           'type' => 'string'],
            ['field' => 'beneficiario_cta_abono', 'type' => 'string'],
            ['field' => 'beneficiario_swift',     'type' => 'string'],
        ],
        'documents' => [
            ['field' => 'analysis_data', 'type' => 'array'],
        ],
    ];

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('⚠  MODO DRY-RUN — no se modificará la base de datos.');
        }

        $totalPlain = 0;
        $totalSkipped = 0;
        $totalErrors = 0;

        foreach ($this->map as $table => $fields) {
            $this->newLine();
            $this->info("━━━ Tabla: {$table} ━━━");

            $fieldNames = array_column($fields, 'field');
            $rows = DB::table($table)->select(['id', ...$fieldNames])->get();

            if ($rows->isEmpty()) {
                $this->line('  Sin registros.');

                continue;
            }

            $bar = $this->output->createProgressBar($rows->count());
            $bar->start();

            foreach ($rows as $row) {
                foreach ($fields as $cfg) {
                    $field = $cfg['field'];
                    $type = $cfg['type'];
                    $raw = $row->$field;

                    if ($raw === null || $raw === '') {
                        $totalSkipped++;

                        continue;
                    }

                    // Detectar si ya está cifrado
                    if ($this->isEncrypted($raw)) {
                        // Verificar que descifra OK con la clave actual
                        try {
                            $type === 'array'
                                ? json_decode(Crypt::decrypt($raw, false), true)
                                : Crypt::decryptString($raw);
                            $totalSkipped++;
                        } catch (\Throwable) {
                            $this->newLine();
                            $this->error("  → {$table}#{$row->id}.{$field}: cifrado con clave distinta — nullificando.");
                            $totalErrors++;
                            if (! $dryRun) {
                                DB::table($table)->where('id', $row->id)->update([$field => null]);
                            }
                        }

                        continue;
                    }

                    // Valor en texto plano → cifrar
                    $totalPlain++;
                    if (! $dryRun) {
                        if ($type === 'array') {
                            // encrypted:array usa Crypt::encrypt($array, serialize=true)
                            $arr = json_decode($raw, true);
                            $encrypted = Crypt::encrypt($arr, true);
                        } else {
                            // encrypted usa Crypt::encryptString($string)
                            $encrypted = Crypt::encryptString($raw);
                        }

                        DB::table($table)->where('id', $row->id)->update([$field => $encrypted]);
                    } else {
                        $this->newLine();
                        $this->warn("  → {$table}#{$row->id}.{$field}: texto plano (se cifraría).");
                    }
                }

                $bar->advance();
            }

            $bar->finish();
            $this->newLine();
        }

        $this->newLine();
        $this->info('✅ Proceso completado:');
        $this->line("   Campos cifrados ahora : {$totalPlain}");
        $this->line("   Ya cifrados (omitidos) : {$totalSkipped}");
        $this->line("   Errores (nullificados) : {$totalErrors}");

        if ($totalErrors > 0) {
            $this->newLine();
            $this->warn('Los campos nullificados estaban cifrados con una APP_KEY diferente y eran irrecuperables.');
        }

        return self::SUCCESS;
    }

    /**
     * Detecta si un valor ya fue cifrado por Laravel (payload base64 con iv/value/mac).
     */
    private function isEncrypted(string $value): bool
    {
        try {
            $decoded = json_decode(base64_decode($value), true);

            return isset($decoded['iv'], $decoded['value'], $decoded['mac']);
        } catch (\Throwable) {
            return false;
        }
    }
}
