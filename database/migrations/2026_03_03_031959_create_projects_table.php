<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->nullable();        // código o número de faena
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // Agregar project_id a document_categories
        Schema::table('document_categories', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_categories', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Project::class);
            $table->dropColumn('project_id');
        });
        Schema::dropIfExists('projects');
    }
};
