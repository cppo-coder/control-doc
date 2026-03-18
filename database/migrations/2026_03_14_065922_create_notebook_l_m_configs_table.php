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
        Schema::create('notebook_l_m_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_category_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('notebook_id')->comment('UUID of the Notebook from Google NotebookLM');
            $table->string('notebook_title')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notebook_l_m_configs');
    }
};
