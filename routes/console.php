<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Limpieza de logs de auditoría antiguos (más de 90 días).
 */
Artisan::command('audit:prune', function () {
    $count = \App\Models\AuditLog::where('created_at', '<', now()->subDays(90))->delete();
    $this->info("Se han eliminado {$count} logs de auditoría antiguos.");
})->purpose('Eliminar logs de auditoría de más de 90 días para ahorrar espacio');

// Programar limpieza mensual
\Illuminate\Support\Facades\Schedule::command('audit:prune')->monthly();
