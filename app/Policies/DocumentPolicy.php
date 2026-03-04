<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

class DocumentPolicy
{
    public function view(User $user, Document $document): bool
    {
        // El usuario solo puede ver si es el dueño del proyecto o admin
        return $user->id === $document->category?->project?->user_id || $user->hasRole('admin');
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor', 'operador']);
    }

    public function delete(User $user, Document $document): bool
    {
        return $user->id === $document->category?->project?->user_id || $user->hasRole('admin');
    }
}
