<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkerDocument extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'worker_documents';

    protected $fillable = [
        'worker_id',
        'tipo',
        'descripcion',
        'fecha_emision',
        'fecha_vencimiento',
        'tiene_documento',
        'archivo_referencia',
        'resultado_ia',
        'estado',
        'creado_por_user_id',
        'modificado_por_user_id',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'fecha_vencimiento' => 'date',
        'tiene_documento' => 'boolean',
        'resultado_ia' => 'array',
    ];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }
}
