<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'document_category_id',
        'name',
        'file_path',
        'analysis_status',
        'analysis_data',
        'analyzed_at',
    ];

    protected $casts = [
        'analysis_data' => 'encrypted:array', // datos médicos/diagnósticos cifrados en reposo
        'analyzed_at'   => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(DocumentCategory::class, 'document_category_id');
    }

    public function hasAlerts(): bool
    {
        return in_array($this->analysis_status, ['alert', 'critical']);
    }

    /** Etiqueta para el audit log */
    public function getAuditLabel(): string
    {
        return $this->name ?? "Document #{$this->id}";
    }
}
