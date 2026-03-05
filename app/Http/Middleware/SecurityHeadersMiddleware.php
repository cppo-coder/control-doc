<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    /**
     * Aplica cabeceras de seguridad a la respuesta HTTP.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevenir Clickjacking
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        
        // Prevenir XSS en navegadores antiguos
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        
        // Prevenir Mime-Type Sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        
        // Referrer Policy
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // HTTP Strict Transport Security (HSTS) - Solo si es HTTPS
        if ($request->secure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Content Security Policy (CSP)
        // En local, omitimos el CSP para no bloquear el servidor de desarrollo de Vite
        if (app()->environment('production')) {
            $csp = "default-src 'self'; " .
                   "script-src 'self' 'unsafe-inline'; " .
                   "script-src-elem 'self' 'unsafe-inline'; " .
                   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.bunny.net; " .
                   "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.bunny.net; " .
                   "font-src 'self' https://fonts.gstatic.com https://fonts.bunny.net data:; " .
                   "img-src 'self' data: https://*; " .
                   "connect-src 'self' https://* wss://*;";

            $response->headers->set('Content-Security-Policy', $csp);
        }

        return $response;
    }
}
