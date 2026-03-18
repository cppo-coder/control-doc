<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Worker;

$workers = Worker::where(function ($q) {
    $q->whereNull('sexo')->orWhere('sexo', '');
})->get();

if ($workers->isEmpty()) {
    echo "No hay trabajadores sin sexo asignado.\n";
    exit;
}

foreach ($workers as $worker) {
    $fullName = $worker->nombres.' '.$worker->apellido_paterno;
    echo "Analizando: {$fullName}...\n";

    // Heurística simple basada en el primer nombre
    $firstName = strtolower(explode(' ', trim($worker->nombres))[0]);
    $lastChar = substr($firstName, -1);

    $femaleNames = ['camila', 'barbara', 'fiona', 'kelly', 'andrea', 'valentina', 'maria', 'josefa', 'javiera', 'isidora', 'fernanda', 'antonella', 'martina', 'sofia', 'florencia', 'daniela', 'paola', 'carla', 'monica', 'beatriz'];
    $maleNames = ['nicolas', 'luis', 'jose', 'mario', 'victor', 'samuel', 'brayan', 'rodrigo', 'aaron', 'camilo', 'isaac', 'gonzalo', 'ricardo', 'hendrix', 'enrique', 'benigno', 'efrain', 'miguel', 'davis', 'brian', 'jhoel', 'pedro', 'jacob', 'esteban', 'brandon', 'jordan', 'alexander', 'andres', 'felipe', 'matias', 'sebastian', 'manuel'];

    if (in_array($firstName, $femaleNames)) {
        $gender = 'Femenino';
    } elseif (in_array($firstName, $maleNames)) {
        $gender = 'Masculino';
    } elseif ($lastChar === 'a' && $firstName !== 'luca' && $firstName !== 'bautista') {
        $gender = 'Femenino';
    } else {
        $gender = 'Masculino';
    }

    $worker->update(['sexo' => $gender]);
    echo "  - Resultado (Heurística): {$gender}\n";
}

echo "Proceso completado.\n";
