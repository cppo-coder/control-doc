<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('worker_documents', function (Blueprint $table) {
            // Almacena el resultado JSON completo del análisis de la IA: imc, drogas, estado clínico, etc.
            $table->json('resultado_ia')->after('archivo_referencia')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('worker_documents', function (Blueprint $table) {
            $table->dropColumn('resultado_ia');
        });
    }
};
