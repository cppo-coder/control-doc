<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Limpiar datos existentes antes de cambiar el tipo (no se pueden migrar)
        DB::statement('ALTER TABLE documents ALTER COLUMN analysis_data TYPE text USING (analysis_data::text)');
    }

    public function down(): void
    {
        // Revertir a json (solo si no hay datos cifrados)
        DB::statement('ALTER TABLE documents ALTER COLUMN analysis_data TYPE json USING (analysis_data::json)');
    }
};
