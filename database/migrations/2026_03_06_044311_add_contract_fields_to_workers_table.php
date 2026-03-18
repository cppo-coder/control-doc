<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            // Tipo de contrato: indefinido, plazo_fijo, obra_faena
            $table->string('tipo_contrato', 20)->nullable()->after('position');
            // Fecha de inicio del contrato (extraída del contrato por IA)
            $table->date('contrato_inicio')->nullable()->after('tipo_contrato');
            // Fecha de término (solo plazo_fijo — null en indefinido y obra_faena)
            $table->date('contrato_termino')->nullable()->after('contrato_inicio');
            // Para obra_faena: fecha del último check mensual realizado
            $table->date('obra_faena_ultimo_check')->nullable()->after('contrato_termino');
            // Para obra_faena: próxima fecha de recordatorio (calculada mensualmente)
            $table->date('obra_faena_proximo_aviso')->nullable()->after('obra_faena_ultimo_check');
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropColumn([
                'tipo_contrato',
                'contrato_inicio',
                'contrato_termino',
                'obra_faena_ultimo_check',
                'obra_faena_proximo_aviso',
            ]);
        });
    }
};
