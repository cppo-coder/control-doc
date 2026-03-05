<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$tz = config('app.timezone');
echo "Timezone: $tz\n";
date_default_timezone_set($tz);

$startDateObj = \Carbon\Carbon::parse('2026-03-11')->startOfDay();
$currentDate = \Carbon\Carbon::parse('2026-03-10')->startOfDay();

echo "Start: " . $startDateObj->toDateTimeString() . "\n";
echo "Current: " . $currentDate->toDateTimeString() . "\n";

$diffInDays = (int) $startDateObj->diffInDays($currentDate, false);
echo "Diff 11 vs 10: " . $diffInDays . "\n";

$startDateObjUTC = \Carbon\Carbon::parse('2026-03-11 00:00:00', 'UTC');
$currentDateUTC = \Carbon\Carbon::parse('2026-03-10 00:00:00', 'UTC');
echo "Diff UTC: " . $startDateObjUTC->diffInDays($currentDateUTC, false) . "\n";
