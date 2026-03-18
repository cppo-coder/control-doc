<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worker_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained()->cascadeOnDelete();

            // Tipo de documento predefinido
            $table->string('tipo'); // contrato, anexo, examen_altura, psicosensotecnico, induccion_riesgo

            // Metadatos del documento
            $table->string('descripcion')->nullable();
            $table->date('fecha_emision')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->boolean('tiene_documento')->default(false);

            // Vinculación con archivo en Drive (ruta relativa o nombre)
            $table->string('archivo_referencia')->nullable(); // ej: "12345678-9/contrato.pdf"

            // Estado calculado: vigente | por_vencer | vencido | pendiente
            $table->string('estado')->default('pendiente');

            $table->timestamps();
            $table->softDeletes();

            // Un trabajador puede tener múltiples documentos del mismo tipo (versionado)
            $table->index(['worker_id', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_documents');
    }
};
