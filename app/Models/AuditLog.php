<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'model_type',
        'model_id',
        'model_label',
        'changes',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'changes' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Registra una acción de auditoría.
     *
     * @param string $action  created|updated|deleted|viewed|downloaded|analyzed
     * @param Model  $model   Modelo afectado
     * @param array  $changes Cambios { before: [], after: [] } (opcional)
     */
    public static function record(string $action, Model $model, array $changes = []): void
    {
        $label = match (true) {
            method_exists($model, 'getAuditLabel') => $model->getAuditLabel(),
            isset($model->name)                    => $model->name,
            isset($model->nombres)                 => $model->nombres . ' ' . ($model->apellido_paterno ?? ''),
            default                                => class_basename($model) . ' #' . $model->getKey(),
        };

        static::create([
            'user_id'     => auth()->id(),
            'action'      => $action,
            'model_type'  => get_class($model),
            'model_id'    => $model->getKey(),
            'model_label' => $label,
            'changes'     => $changes ?: null,
            'ip_address'  => request()->ip(),
            'user_agent'  => substr(request()->userAgent() ?? '', 0, 255),
        ]);
    }
}
