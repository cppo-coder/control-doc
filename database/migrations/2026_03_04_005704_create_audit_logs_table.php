<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');           // viewed, created, updated, deleted, downloaded, analyzed
            $table->string('model_type');       // App\Models\Document, App\Models\Worker, etc.
            $table->unsignedBigInteger('model_id')->nullable();
            $table->string('model_label')->nullable(); // nombre/descripción del registro afectado
            $table->json('changes')->nullable();  // { before: {}, after: {} }
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            $table->index(['model_type', 'model_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
