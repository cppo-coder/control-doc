<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $fillable = [
        'document_category_id',
        'name',
        'file_path',
        'analysis_status',
        'analysis_data',
        'analyzed_at',
    ];

    protected $casts = [
        'analysis_data' => 'array',
        'analyzed_at'   => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(DocumentCategory::class, 'document_category_id');
    }

    /** Retorna true si hay al menos una alerta */
    public function hasAlerts(): bool
    {
        return in_array($this->analysis_status, ['alert', 'critical']);
    }
}
