<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notebook_l_m_documents', function (Blueprint $table) {
            $table->string('source_id')->nullable()->change();
            $table->string('sync_status')->default('registered')->after('source_id');
            $table->text('sync_error')->nullable()->after('sync_status');
            $table->timestamp('synced_at')->nullable()->after('sync_error');
            $table->foreignId('matched_worker_id')->nullable()->after('document_id')->constrained('workers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notebook_l_m_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('matched_worker_id');
            $table->dropColumn(['sync_status', 'sync_error', 'synced_at']);
        });
    }
};
