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

        // Content Security Policy (CSP) - Ajustada para Vite + Inertia
        // Nota: En producción sería más estricta, aquí permitimos hashes/blobs para desarrollo local
        $csp = "default-src 'self'; " .
               "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " . // eval necesario para compilación JIT de React en dev
               "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " .
               "font-src 'self' https://fonts.gstatic.com data:; " .
               "img-src 'self' data: https://* http://*; " .
               "connect-src 'self' https://* http://* ws://* wss://*;";
        
        $response->headers->set('Content-Security-Policy', $csp);

        return $response;
    }
}
