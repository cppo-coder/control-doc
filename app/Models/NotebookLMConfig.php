<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotebookLMConfig extends Model
{
    protected $table = 'notebook_l_m_configs';

    protected $fillable = ['document_category_id', 'notebook_id', 'notebook_title'];

    public function category()
    {
        return $this->belongsTo(DocumentCategory::class, 'document_category_id');
    }
}
