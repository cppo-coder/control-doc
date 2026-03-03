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
            // Already there or to be refined:
            // rut, name, email, phone, position, department, is_active

            $table->string('nacionalidad')->nullable()->after('rut');
            $table->string('pasaporte')->nullable()->after('nacionalidad');
            $table->string('documento_identidad')->nullable()->after('pasaporte');
            
            // Re-organizing name
            $table->string('nombres')->nullable()->after('documento_identidad');
            $table->string('apellido_paterno')->nullable()->after('nombres');
            $table->string('apellido_materno')->nullable()->after('apellido_paterno');
            
            $table->date('fecha_nacimiento')->nullable()->after('apellido_materno');
            $table->string('estado_civil')->nullable()->after('fecha_nacimiento');
            $table->string('direccion')->nullable()->after('estado_civil');
            $table->string('comuna')->nullable()->after('direccion');
            
            $table->string('whatsapp')->nullable()->after('phone');
            $table->string('emergencia_contacto_numero')->nullable()->after('whatsapp');
            $table->string('emergencia_contacto_nombre')->nullable()->after('emergencia_contacto_numero');
            
            // Payment info
            $table->string('cta_bancaria')->nullable();
            $table->string('cod_banco')->nullable();
            $table->string('tipo_cuenta')->nullable();
            $table->string('beneficiario_direccion')->nullable();
            $table->string('beneficiario_ciudad')->nullable();
            $table->string('beneficiario_cta_abono')->nullable();
            $table->string('beneficiario_swift')->nullable();
            
            // De-prioritizing generic name
            if (Schema::hasColumn('workers', 'name')) {
                $table->string('name')->nullable()->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropColumn([
                'nacionalidad', 'pasaporte', 'documento_identidad', 'nombres', 
                'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 
                'estado_civil', 'direccion', 'comuna', 'whatsapp', 
                'emergencia_contacto_numero', 'emergencia_contacto_nombre',
                'cta_bancaria', 'cod_banco', 'tipo_cuenta', 
                'beneficiario_direccion', 'beneficiario_ciudad', 
                'beneficiario_cta_abono', 'beneficiario_swift'
            ]);
        });
    }
};
