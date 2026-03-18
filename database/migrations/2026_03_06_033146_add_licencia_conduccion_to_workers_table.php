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
        Schema::table('workers', function (Blueprint $table) {
            $table->boolean('licencia_conduccion')->default(false)->after('is_active');
            $table->date('licencia_conduccion_vencimiento')->nullable()->after('licencia_conduccion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropColumn(['licencia_conduccion', 'licencia_conduccion_vencimiento']);
        });
    }
};
