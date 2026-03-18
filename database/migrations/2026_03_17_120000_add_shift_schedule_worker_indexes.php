<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shift_schedule_worker', function (Blueprint $table) {
            $table->index(
                ['shift_schedule_id', 'end_date', 'start_date', 'worker_id'],
                'ssw_schedule_dates_worker_idx'
            );
            $table->index(
                ['worker_id', 'end_date', 'shift_schedule_id'],
                'ssw_worker_end_schedule_idx'
            );
            $table->index(
                ['shift_schedule_id', 'worker_id', 'end_date'],
                'ssw_schedule_worker_end_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('shift_schedule_worker', function (Blueprint $table) {
            $table->dropIndex('ssw_schedule_dates_worker_idx');
            $table->dropIndex('ssw_worker_end_schedule_idx');
            $table->dropIndex('ssw_schedule_worker_end_idx');
        });
    }
};
