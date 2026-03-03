<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // 'pending' | 'clean' | 'alert' | 'critical' | 'error'
            $table->string('analysis_status')->default('pending')->after('file_path');
            $table->json('analysis_data')->nullable()->after('analysis_status');
            $table->timestamp('analyzed_at')->nullable()->after('analysis_data');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['analysis_status', 'analysis_data', 'analyzed_at']);
        });
    }
};
