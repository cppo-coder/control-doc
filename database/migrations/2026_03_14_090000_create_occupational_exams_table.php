<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('occupational_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_id')->nullable()->constrained()->nullOnDelete();
            $table->string('worker_name')->nullable();
            $table->string('worker_rut')->nullable();
            $table->string('exam_type')->nullable();
            $table->date('exam_date')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('fitness')->nullable();
            $table->text('summary')->nullable();
            $table->decimal('imc_value', 8, 2)->nullable();
            $table->string('imc_category')->nullable();
            $table->boolean('imc_alert')->default(false);
            $table->boolean('imc_critical')->default(false);
            $table->string('toxicology_status')->nullable();
            $table->text('toxicology_detail')->nullable();
            $table->boolean('alcohol_detected')->default(false);
            $table->boolean('drugs_detected')->default(false);
            $table->string('blood_pressure')->nullable();
            $table->decimal('total_cholesterol', 8, 2)->nullable();
            $table->decimal('hdl_cholesterol', 8, 2)->nullable();
            $table->decimal('ldl_cholesterol', 8, 2)->nullable();
            $table->decimal('triglycerides', 8, 2)->nullable();
            $table->decimal('glucose', 8, 2)->nullable();
            $table->decimal('pulse', 8, 2)->nullable();
            $table->decimal('respiratory_rate', 8, 2)->nullable();
            $table->decimal('hemoglobin', 8, 2)->nullable();
            $table->decimal('creatinine', 8, 2)->nullable();
            $table->string('electrocardiogram')->nullable();
            $table->string('chest_xray')->nullable();
            $table->string('framingham_index')->nullable();
            $table->string('lake_louise_score')->nullable();
            $table->json('findings')->nullable();
            $table->json('recommendations')->nullable();
            $table->json('restrictions')->nullable();
            $table->json('raw_analysis')->nullable();
            $table->timestamps();

            $table->unique('document_id');
            $table->index(['worker_id', 'exam_type']);
            $table->index(['status', 'fitness']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('occupational_exams');
    }
};
