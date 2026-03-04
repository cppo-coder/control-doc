<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Worker extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'rut',
        'nacionalidad',
        'pasaporte',
        'documento_identidad',
        'nombres',
        'apellido_paterno',
        'apellido_materno',
        'fecha_nacimiento',
        'estado_civil',
        'direccion',
        'comuna',
        'email',
        'phone',
        'whatsapp',
        'emergencia_contacto_numero',
        'emergencia_contacto_nombre',
        'cta_bancaria',
        'cod_banco',
        'tipo_cuenta',
        'beneficiario_direccion',
        'beneficiario_ciudad',
        'beneficiario_cta_abono',
        'beneficiario_swift',
        'name',
        'position',
        'department',
        'is_active',
    ];

    protected $casts = [
        // Datos bancarios cifrados en reposo
        'cta_bancaria'             => 'encrypted',
        'beneficiario_cta_abono'   => 'encrypted',
        'beneficiario_swift'       => 'encrypted',
        'is_active'                => 'boolean',
        'fecha_nacimiento'         => 'date',
    ];

    public function courses()
    {
        return $this->hasMany(Course::class);
    }

    /** Etiqueta para el audit log */
    public function getAuditLabel(): string
    {
        return trim("{$this->nombres} {$this->apellido_paterno}") ?: "Worker #{$this->id}";
    }
}
