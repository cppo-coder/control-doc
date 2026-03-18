<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('worker_documents', function (Blueprint $table) {
            // Ampliar descripcion a TEXT para soportar resúmenes de la IA (que superan 255 chars)
            $table->text('descripcion')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('worker_documents', function (Blueprint $table) {
            $table->string('descripcion', 255)->nullable()->change();
        });
    }
};
