<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OccupationalExam extends Model
{
    protected $fillable = [
        'document_id',
        'worker_id',
        'worker_name',
        'worker_rut',
        'document_number',
        'document_number_type',
        'exam_type',
        'exam_date',
        'expires_at',
        'status',
        'fitness',
        'summary',
        'imc_value',
        'imc_category',
        'imc_alert',
        'imc_critical',
        'toxicology_status',
        'toxicology_detail',
        'alcohol_detected',
        'drugs_detected',
        'blood_pressure',
        'total_cholesterol',
        'hdl_cholesterol',
        'ldl_cholesterol',
        'triglycerides',
        'glucose',
        'pulse',
        'respiratory_rate',
        'hemoglobin',
        'creatinine',
        'electrocardiogram',
        'chest_xray',
        'framingham_index',
        'lake_louise_score',
        'findings',
        'recommendations',
        'restrictions',
        'raw_analysis',
    ];

    protected $casts = [
        'exam_date' => 'date',
        'expires_at' => 'date',
        'imc_value' => 'decimal:2',
        'imc_alert' => 'boolean',
        'imc_critical' => 'boolean',
        'alcohol_detected' => 'boolean',
        'drugs_detected' => 'boolean',
        'total_cholesterol' => 'decimal:2',
        'hdl_cholesterol' => 'decimal:2',
        'ldl_cholesterol' => 'decimal:2',
        'triglycerides' => 'decimal:2',
        'glucose' => 'decimal:2',
        'pulse' => 'decimal:2',
        'respiratory_rate' => 'decimal:2',
        'hemoglobin' => 'decimal:2',
        'creatinine' => 'decimal:2',
        'findings' => 'array',
        'recommendations' => 'array',
        'restrictions' => 'array',
        'raw_analysis' => 'array',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }
}
