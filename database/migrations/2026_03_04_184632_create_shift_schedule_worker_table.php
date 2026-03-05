<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_schedule_worker', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['shift_schedule_id', 'worker_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_schedule_worker');
    }
};
