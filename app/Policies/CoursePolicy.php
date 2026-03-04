<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor', 'operador', 'auditor']);
    }

    public function view(User $user, Course $course): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor', 'operador', 'auditor']);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor']);
    }

    public function update(User $user, Course $course): bool
    {
        return $user->hasAnyRole(['admin', 'supervisor']);
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->hasRole('admin');
    }
}
