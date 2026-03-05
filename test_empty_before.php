<?php
require 'vendor/autoload.php';
$startDateObj = \Carbon\Carbon::parse('2026-03-11')->startOfDay();
$work_days = 8;
$rest_days = 6;
$totalCycle = 14;

for ($i = 1; $i <= 31; $i++) {
    $dateString = sprintf('%04d-%02d-%02d', 2026, 3, $i);
    $currentDate = \Carbon\Carbon::parse($dateString)->startOfDay();
    
    if ($currentDate->lessThan($startDateObj)) {
        echo "Day $i: (blank)\n";
        continue;
    }

    $diffInDays = (int) $startDateObj->diffInDays($currentDate, false);
    $iteration = (($diffInDays % $totalCycle) + $totalCycle) % $totalCycle;
    $type = ($iteration < $work_days) ? 'trabajo' : 'descanso';
    echo "Day $i: $type\n";
}
