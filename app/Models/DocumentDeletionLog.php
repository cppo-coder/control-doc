<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentDeletionLog extends Model
{
    protected $fillable = [
        'deleted_by',
        'document_name',
        'file_path',
        'category_name',
        'project_name',
        'ip_address',
        'user_agent',
    ];

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
