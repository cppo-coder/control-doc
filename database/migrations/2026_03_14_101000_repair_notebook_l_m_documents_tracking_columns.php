<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('notebook_l_m_documents')) {
            return;
        }

        if (! Schema::hasColumn('notebook_l_m_documents', 'matched_worker_id')) {
            Schema::table('notebook_l_m_documents', function (Blueprint $table) {
                $table->foreignId('matched_worker_id')
                    ->nullable()
                    ->after('document_id')
                    ->constrained('workers')
                    ->nullOnDelete();
            });
        }

        Schema::table('notebook_l_m_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('notebook_l_m_documents', 'sync_status')) {
                $table->string('sync_status')->default('registered')->after('source_id');
            }

            if (! Schema::hasColumn('notebook_l_m_documents', 'sync_error')) {
                $table->text('sync_error')->nullable()->after('sync_status');
            }

            if (! Schema::hasColumn('notebook_l_m_documents', 'synced_at')) {
                $table->timestamp('synced_at')->nullable()->after('sync_error');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('notebook_l_m_documents')) {
            return;
        }

        Schema::table('notebook_l_m_documents', function (Blueprint $table) {
            if (Schema::hasColumn('notebook_l_m_documents', 'matched_worker_id')) {
                $table->dropConstrainedForeignId('matched_worker_id');
            }

            $columnsToDrop = [];

            foreach (['sync_status', 'sync_error', 'synced_at'] as $column) {
                if (Schema::hasColumn('notebook_l_m_documents', $column)) {
                    $columnsToDrop[] = $column;
                }
            }

            if ($columnsToDrop !== []) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
