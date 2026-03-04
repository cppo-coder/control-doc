<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // ── Vite prefetch con concurrencia 3 ──────────────────────────────
        Vite::prefetch(concurrency: 3);

        // ── Optimizaciones de Eloquent (producción) ────────────────────────
        // Previene lazy loading accidental (N+1 queries) en desarrollo
        Model::preventLazyLoading(! app()->isProduction());

        // Previene asignación masiva silenciosa en desarrollo
        Model::preventSilentlyDiscardingAttributes(! app()->isProduction());

        // ── Logging de queries lentas (>200ms) ────────────────────────────
        if (! app()->isProduction()) {
            DB::listen(function ($query) {
                if ($query->time > 200) {
                    \Illuminate\Support\Facades\Log::warning('Slow Query detected', [
                        'sql'      => $query->sql,
                        'bindings' => $query->bindings,
                        'time'     => $query->time . 'ms',
                    ]);
                }
            });
        }

        // ── Google Drive Filesystem ───────────────────────────────────────
        \Illuminate\Support\Facades\Storage::extend('google', function ($app, $config) {
            $options = [];
            if (! empty($config['teamDriveId'] ?? null)) {
                $options['teamDriveId'] = $config['teamDriveId'];
            }
            if (! empty($config['sharedFolderId'] ?? null)) {
                $options['sharedFolderId'] = $config['sharedFolderId'];
            }
            $client = new \Google\Client();
            $client->setClientId($config['clientId']);
            $client->setClientSecret($config['clientSecret']);
            $client->refreshToken($config['refreshToken']);
            $service = new \Google\Service\Drive($client);
            $adapter = new \Masbug\Flysystem\GoogleDriveAdapter($service, $config['folder'] ?? '/', $options);
            $driver  = new \League\Flysystem\Filesystem($adapter);
            return new \Illuminate\Filesystem\FilesystemAdapter($driver, $adapter, $config);
        });
    }
}
