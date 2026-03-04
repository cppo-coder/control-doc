<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Worker;
use Illuminate\Auth\Access\Response;

class WorkerPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        // Todos los roles autorizados pueden listar
        return $user->hasAnyRole(['admin', 'supervisor', 'operador', 'auditor']);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Worker $worker): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor', 'operador', 'auditor']);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor']);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Worker $worker): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor']);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Worker $worker): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Worker $worker): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Worker $worker): bool
    {
        return $user->hasRole('admin');
    }
}
