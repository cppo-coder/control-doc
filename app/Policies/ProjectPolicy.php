<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    /**
     * Todos los usuarios autenticados pueden ver proyectos (Inertia ya filtra por user_id).
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Solo el dueño del proyecto o el admin pueden verlo.
     */
    public function view(User $user, Project $project): bool
    {
        return $user->id === $project->user_id || $user->hasRole('admin');
    }

    /**
     * Admin y supervisores pueden crear proyectos.
     */
    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor']);
    }

    /**
     * Solo el dueño o el admin pueden editar.
     */
    public function update(User $user, Project $project): bool
    {
        return $user->id === $project->user_id || $user->hasRole('admin');
    }

    /**
     * Solo el dueño o el admin pueden borrar.
     */
    public function delete(User $user, Project $project): bool
    {
        return $user->id === $project->user_id || $user->hasRole('admin');
    }
}
