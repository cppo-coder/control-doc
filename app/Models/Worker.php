<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Worker extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'rut',
        'nacionalidad',
        'pasaporte',
        'documento_identidad',
        'nombres',
        'apellido_paterno',
        'apellido_materno',
        'sexo',
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
        'licencia_conduccion',
        'licencia_conduccion_vencimiento',
        // Datos de contrato (actualizados por IA)
        'tipo_contrato',
        'contrato_inicio',
        'contrato_termino',
        'obra_faena_ultimo_check',
        'obra_faena_proximo_aviso',
    ];

    protected $casts = [
        'cta_bancaria' => 'encrypted',
        'beneficiario_cta_abono' => 'encrypted',
        'beneficiario_swift' => 'encrypted',
        'is_active' => 'boolean',
        'licencia_conduccion' => 'boolean',
        'fecha_nacimiento' => 'date',
        'licencia_conduccion_vencimiento' => 'date',
        'contrato_inicio' => 'date',
        'contrato_termino' => 'date',
        'obra_faena_ultimo_check' => 'date',
        'obra_faena_proximo_aviso' => 'date',
    ];

    public function courses()
    {
        return $this->hasMany(Course::class);
    }

    public function documents()
    {
        return $this->hasMany(WorkerDocument::class);
    }

    /** Etiqueta para el audit log */
    public function getAuditLabel(): string
    {
        return trim("{$this->nombres} {$this->apellido_paterno}") ?: "Worker #{$this->id}";
    }
}
