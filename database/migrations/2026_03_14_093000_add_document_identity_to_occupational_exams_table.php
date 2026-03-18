<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('occupational_exams', function (Blueprint $table) {
            $table->string('document_number')->nullable()->after('worker_rut');
            $table->string('document_number_type')->nullable()->after('document_number');
        });
    }

    public function down(): void
    {
        Schema::table('occupational_exams', function (Blueprint $table) {
            $table->dropColumn(['document_number', 'document_number_type']);
        });
    }
};
