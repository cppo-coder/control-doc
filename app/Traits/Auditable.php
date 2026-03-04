<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

trait Auditable
{
    /**
     * Boot del trait para registrar eventos de auditoría.
     */
    public static function bootAuditable(): void
    {
        static::created(function (Model $model) {
            // Filtrar datos sensibles en el log de creación
            $data = $model->toArray();
            $exclude = self::getAuditExcludedFields($model);
            
            foreach ($exclude as $field) {
                if (isset($data[$field])) {
                    $data[$field] = '[CIFRADO/REDACTADO]';
                }
            }

            AuditLog::record('created', $model, ['after' => $data]);
        });

        static::updated(function (Model $model) {
            $dirty = $model->getDirty();
            $exclude = self::getAuditExcludedFields($model);
            
            // Excluir campos técnicos y sensibles del diff
            $skip = array_merge(['updated_at', 'created_at'], $exclude);
            $before = [];
            $after  = [];

            foreach ($dirty as $field => $newValue) {
                if (in_array($field, $skip)) continue;
                $before[$field] = $model->getOriginal($field);
                $after[$field]  = $newValue;
            }

            if (!empty($before)) {
                AuditLog::record('updated', $model, compact('before', 'after'));
            }
        });

        static::deleted(function (Model $model) {
            AuditLog::record('deleted', $model);
        });
    }

    /**
     * Obtiene los campos que no deben ser registrados en el log de auditoría.
     */
    protected static function getAuditExcludedFields(Model $model): array
    {
        // Campos definidos en el modelo o campos ocultos (hidden) por defecto
        $customExclude = property_exists($model, 'auditExclude') ? $model->auditExclude : [];
        $hidden = $model->getHidden();
        
        // Agregar campos cifrados automáticamente si es posible (basado en casts)
        $encrypted = [];
        if (method_exists($model, 'getCasts')) {
            foreach ($model->getCasts() as $field => $cast) {
                if (str_contains($cast, 'encrypted')) {
                    $encrypted[] = $field;
                }
            }
        }

        return array_unique(array_merge($customExclude, $hidden, $encrypted));
    }
}
