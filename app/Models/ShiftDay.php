<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShiftDay extends Model
{
    use HasFactory;

    protected $fillable = [
        'shift_schedule_id',
        'worker_id',
        'date',
        'type',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function schedule()
    {
        return $this->belongsTo(ShiftSchedule::class, 'shift_schedule_id');
    }

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }
}
