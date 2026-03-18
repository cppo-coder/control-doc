<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class LocalAutoLogin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment('local') || ! config('auth.local_auto_login.enabled')) {
            return $next($request);
        }

        if (Auth::check()) {
            return $next($request);
        }

        $user = $this->resolveUser();

        if (! $user) {
            return $next($request);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return $next($request);
    }

    protected function resolveUser(): ?User
    {
        $userId = config('auth.local_auto_login.user_id');
        $userEmail = config('auth.local_auto_login.user_email');

        if ($userId) {
            return User::query()->find($userId);
        }

        if ($userEmail) {
            return User::query()->where('email', $userEmail)->first();
        }

        return User::query()->orderBy('id')->first();
    }
}
