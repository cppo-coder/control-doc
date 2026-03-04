<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- documents ---
        Schema::table('documents', function (Blueprint $table) {
            $table->index('document_category_id');        // FK más usada en joins
            $table->index('analysis_status');             // filtrado por estado
            $table->index('analyzed_at');                 // ordenar por fecha análisis
            $table->index('created_at');                  // ordenar por fecha subida
        });

        // --- document_categories ---
        Schema::table('document_categories', function (Blueprint $table) {
            $table->index('project_id');                  // FK más usada
        });

        // --- projects ---
        Schema::table('projects', function (Blueprint $table) {
            $table->index('user_id');                     // filtrado por usuario
            $table->index('created_at');                  // ordenar por reciente
        });

        // --- workers ---
        Schema::table('workers', function (Blueprint $table) {
            $table->index(['apellido_paterno', 'nombres']); // ordenación del listado
            $table->index('nacionalidad');                   // filtrado por nacionalidad
            $table->index('deleted_at');                     // soft delete queries
        });

        // --- courses ---
        Schema::table('courses', function (Blueprint $table) {
            $table->index('worker_id');                   // FK más usada
            $table->index('created_at');
        });

        // --- audit_logs ---
        // Ya tiene índices en su migración, no se repiten
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['document_category_id']);
            $table->dropIndex(['analysis_status']);
            $table->dropIndex(['analyzed_at']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('document_categories', function (Blueprint $table) {
            $table->dropIndex(['project_id']);
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('workers', function (Blueprint $table) {
            $table->dropIndex(['apellido_paterno', 'nombres']);
            $table->dropIndex(['nacionalidad']);
            $table->dropIndex(['deleted_at']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex(['worker_id']);
            $table->dropIndex(['created_at']);
        });
    }
};
