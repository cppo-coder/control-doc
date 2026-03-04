<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aplica mejoras de Seguridad (Auditoría Inmutable) y Rendimiento (Búsquedas GIN)
     * directamente en el motor PostgreSQL.
     */
    public function up(): void
    {
        // ── RENDIMIENTO: Habilitar extensión de trigramas para búsquedas rápidas ──
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        // Índices GIN (Generalized Inverted Index) para búsquedas parciales (LIKE %texto%)
        // Son mucho más rápidos que los índices btree convencionales para búsquedas de texto.
        DB::statement('CREATE INDEX workers_nombres_trgm_idx ON workers USING gin (nombres gin_trgm_ops)');
        DB::statement('CREATE INDEX workers_apellidos_trgm_idx ON workers USING gin (apellido_paterno gin_trgm_ops)');

        // ── SEGURIDAD: Auditoría a nivel de motor (Triggers) ─────────────────
        
        // 1. Crear función para registrar auditoría automáticamente
        DB::statement("
            CREATE OR REPLACE FUNCTION log_worker_changes()
            RETURNS TRIGGER AS $$
            DECLARE
                user_id_val INT;
            BEGIN
                -- Intentar capturar el ID de usuario desde una variable de sesión opcional
                BEGIN
                    user_id_val := NULLIF(current_setting('app.current_user_id', true), '')::INT;
                EXCEPTION WHEN OTHERS THEN
                    user_id_val := NULL;
                END;

                IF (TG_OP = 'UPDATE') THEN
                    INSERT INTO audit_logs (user_id, action, model_type, model_id, model_label, changes, ip_address, user_agent, created_at, updated_at)
                    VALUES (
                        user_id_val, 
                        'updated_db', 
                        'App\\Models\\Worker', 
                        old.id, 
                        old.nombres || ' ' || old.apellido_paterno,
                        jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)),
                        '127.0.0.1',
                        'PostgreSQL System Trigger',
                        now(),
                        now()
                    );
                    RETURN NEW;
                ELSIF (TG_OP = 'DELETE') THEN
                    INSERT INTO audit_logs (user_id, action, model_type, model_id, model_label, created_at, updated_at)
                    VALUES (user_id_val, 'deleted_db', 'App\\Models\\Worker', old.id, old.nombres || ' ' || old.apellido_paterno, now(), now());
                    RETURN OLD;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        ");

        // 2. Adjuntar trigger a la tabla workers
        DB::statement("
            CREATE TRIGGER trg_audit_worker_changes
            AFTER UPDATE OR DELETE ON workers
            FOR EACH ROW EXECUTE FUNCTION log_worker_changes();
        ");

        // ── INTEGRIDAD: Constraints de limpieza ──
        DB::statement("ALTER TABLE workers ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_audit_worker_changes ON workers');
        DB::statement('DROP FUNCTION IF EXISTS log_worker_changes()');
        DB::statement('DROP INDEX IF EXISTS workers_nombres_trgm_idx');
        DB::statement('DROP INDEX IF EXISTS workers_apellidos_trgm_idx');
        DB::statement('ALTER TABLE workers DROP CONSTRAINT IF EXISTS check_email_format');
    }
};
