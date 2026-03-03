<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
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
        'is_active'
    ];
}
