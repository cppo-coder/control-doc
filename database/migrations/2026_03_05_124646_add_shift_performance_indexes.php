<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add performance indexes to shift_schedules
        Schema::table('shift_schedules', function (Blueprint $table) {
            $table->index('user_id');
            $table->index(['year', 'month']);
        });

        // Add index to shift_days for faster lookups by worker and date
        Schema::table('shift_days', function (Blueprint $table) {
            $table->index(['worker_id', 'date']);
            $table->index(['shift_schedule_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shift_schedules', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->dropIndex(['year', 'month']);
        });

        Schema::table('shift_days', function (Blueprint $table) {
            $table->dropIndex(['worker_id', 'date']);
            $table->dropIndex(['shift_schedule_id', 'date']);
        });
    }
};
