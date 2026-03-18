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
        Schema::create('notebooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('external_id')->unique()->comment('NotebookLM UUID');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notebooks');
    }
};
