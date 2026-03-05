<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShiftSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'color',
        'work_days',
        'rest_days',
        'start_date',
        'end_date',
        'year',
        'month',
        'sort_order',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function days()
    {
        return $this->hasMany(ShiftDay::class);
    }

    public function workers()
    {
        return $this->belongsToMany(Worker::class, 'shift_schedule_worker')->withPivot(['id', 'shift_schedule_id', 'start_date', 'end_date'])->withTimestamps();
    }
}
