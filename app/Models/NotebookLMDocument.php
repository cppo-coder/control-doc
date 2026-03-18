<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotebookLMDocument extends Model
{
    protected $table = 'notebook_l_m_documents';

    protected $fillable = [
        'document_id',
        'matched_worker_id',
        'notebook_id',
        'source_id',
        'sync_status',
        'sync_error',
        'synced_at',
    ];

    protected $casts = [
        'synced_at' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function matchedWorker()
    {
        return $this->belongsTo(Worker::class, 'matched_worker_id');
    }
}
