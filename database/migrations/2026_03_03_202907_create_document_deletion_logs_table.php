<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_deletion_logs', function (Blueprint $table) {
            $table->id();

            // Quién eliminó
            $table->foreignId('deleted_by')->constrained('users')->cascadeOnDelete();

            // Datos del documento eliminado (guardados para histórico)
            $table->string('document_name');
            $table->string('file_path');

            // Contexto: categoría y proyecto
            $table->string('category_name')->nullable();
            $table->string('project_name')->nullable();

            // IP y metadata extra
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->timestamps(); // created_at = momento de eliminación
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_deletion_logs');
    }
};
