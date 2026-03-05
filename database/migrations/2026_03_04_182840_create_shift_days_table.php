<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            // Tipos: trabajo | descanso | licencia_con_goce | licencia_sin_goce
            //        permiso_con_goce | permiso_sin_goce | inicio_contrato | finiquitado
            $table->string('type', 30);
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['shift_schedule_id', 'worker_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_days');
    }
};
