<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $fillable = [
        'worker_id',
        'nombre_curso',
        'fecha_realizacion'
    ];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }
}
