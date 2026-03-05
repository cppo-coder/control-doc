<?php
require 'vendor/autoload.php';
$startDateObj = \Carbon\Carbon::parse('2026-03-11')->startOfDay();
$currentDate = \Carbon\Carbon::parse('2026-03-10')->startOfDay();
echo "diff 10th: " . $startDateObj->diffInDays($currentDate, false) . "\n";
echo "diff 11th: " . $startDateObj->diffInDays(\Carbon\Carbon::parse('2026-03-11')->startOfDay(), false) . "\n";
echo "diff 1st: " . $startDateObj->diffInDays(\Carbon\Carbon::parse('2026-03-01')->startOfDay(), false) . "\n";
