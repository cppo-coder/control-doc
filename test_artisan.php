<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$schedule = App\Models\ShiftSchedule::find(4);
echo "Start Date: " . $schedule->start_date . "\n";
echo "Work: " . $schedule->work_days . "\n";
echo "Rest: " . $schedule->rest_days . "\n";

$startDateObj = \Carbon\Carbon::parse($schedule->start_date)->startOfDay();
$totalCycle = $schedule->work_days + $schedule->rest_days;
$workPattern = $schedule->work_days;

for ($day = 1; $day <= 15; $day++) {
    $dateString = sprintf('%04d-%02d-%02d', 2026, 3, $day);
    $currentDate = \Carbon\Carbon::parse($dateString)->startOfDay();
    $diffInDays = (int) $startDateObj->diffInDays($currentDate, false);
    $iteration = (($diffInDays % $totalCycle) + $totalCycle) % $totalCycle;
    $type = ($iteration < $workPattern) ? 'trabajo' : 'descanso';
    echo "Day $day: $type (diff: $diffInDays, iter: $iteration)\n";
}
