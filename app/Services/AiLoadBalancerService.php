<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiLoadBalancerService
{
    protected ?array $lastUsage = null;

    /**
     * @return array<string, array<int, string>>
     */
    protected function geminiPreferredProfiles(): array
    {
        return [
            'pdf_nativo' => [
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash',
                'gemini-flash-latest',
                'gemini-pro-latest',
            ],
            'ocr_pdf' => [
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite',
                'gemini-flash-lite-latest',
            ],
            'revision_agotamiento' => [
                'gemini-2.0-flash-lite',
                'gemini-2.5-flash-lite',
                'gemini-flash-lite-latest',
                'gemini-3-flash-preview',
                'gemini-3.1-flash-lite-preview',
                'gemini-3.1-pro-preview',
            ],
        ];
    }

    public function updateRoute(string $id, array $attributes): array
    {
        $routes = $this->configuredAnalysisRoutes();
        $route = collect($routes)->firstWhere('id', $id);

        if (! $route) {
            throw new \RuntimeException('La ruta indicada no existe.');
        }

        $allowed = array_intersect_key($attributes, array_flip(['enabled', 'model', 'weight']));
        $overrides = Cache::get('ai_lb:route_overrides', []);

        $current = $overrides[$id] ?? [];
        $next = array_merge($current, $allowed);

        if (array_key_exists('enabled', $next)) {
            $next['enabled'] = (bool) $next['enabled'];
        }

        if (array_key_exists('weight', $next)) {
            $next['weight'] = max(1, (int) $next['weight']);
        }

        $overrides[$id] = $next;
        Cache::forever('ai_lb:route_overrides', $overrides);

        return $this->status();
    }

    public function status(): array
    {
        $configuredRoutes = $this->configuredAnalysisRoutes();
        $activeRoutes = array_values(array_filter($configuredRoutes, function (array $route) {
            return $route['enabled'] && $route['has_credentials'] && ! $route['cooldown_active'];
        }));

        return [
            'strategy' => config('services.ai_load_balancer.strategy', 'round_robin'),
            'cooldown_seconds' => (int) config('services.ai_load_balancer.cooldown_seconds', 90),
            'max_attempts' => (int) config('services.ai_load_balancer.max_attempts', 6),
            'ocr_max_attempts' => (int) config('services.ai_load_balancer.ocr_max_attempts', 4),
            'providers' => [
                'gemini' => $this->providerStatus('gemini', $configuredRoutes),
                'groq' => $this->providerStatus('groq', $configuredRoutes),
                'cerebras' => $this->providerStatus('cerebras', $configuredRoutes),
            ],
            'summary' => [
                'configured' => count($configuredRoutes),
                'enabled' => count(array_filter($configuredRoutes, fn (array $route) => $route['enabled'])),
                'healthy' => count($activeRoutes),
                'cooling_down' => count(array_filter($configuredRoutes, fn (array $route) => $route['cooldown_active'])),
                'missing_credentials' => count(array_filter($configuredRoutes, fn (array $route) => ! $route['has_credentials'])),
                'mixed_rotation' => $this->mixedRotationPreview('pdf_nativo'),
            ],
            'routes' => $configuredRoutes,
            'monitor' => [
                'server_time' => now()->format('Y-m-d H:i:s'),
                'rows' => array_map(fn (array $route) => $this->buildMonitorRow($route), $configuredRoutes),
                'note' => 'RPM/TPM se reinician cada minuto exacto. RPD/TPD se limpian a medianoche.',
            ],
            'last_usage' => $this->lastUsage,
        ];
    }

    public function analyzeJson(string $prompt, array $options = []): array
    {
        $this->lastUsage = null;

        $routes = $this->limitRoutes(
            $this->orderedRoutes($this->analysisRoutes($options)),
            (int) config('services.ai_load_balancer.max_attempts', 6)
        );

        if ($routes === []) {
            throw new \RuntimeException('No hay rutas de IA disponibles para el balanceador.');
        }

        $errors = [];

        foreach ($routes as $route) {
            try {
                return $this->dispatchJsonRequest($route, $prompt);
            } catch (ConnectionException $e) {
                $this->markRouteUnavailable($route, 'connection');
                $errors[] = $this->formatRouteError($route, $e->getMessage());
                Log::warning('[AI-LB] Error de conexion con ruta IA.', [
                    'route' => $route['id'],
                    'provider' => $route['provider'],
                    'model' => $route['model'],
                    'error' => $e->getMessage(),
                ]);
            } catch (RequestException $e) {
                $reason = $this->cooldownReason($e);
                if ($reason !== null) {
                    $this->markRouteUnavailable($route, $reason);
                }

                $errors[] = $this->formatRouteError($route, $e->getMessage());
                Log::warning('[AI-LB] Ruta IA respondio con error HTTP.', [
                    'route' => $route['id'],
                    'provider' => $route['provider'],
                    'model' => $route['model'],
                    'status' => $e->response?->status(),
                    'error' => $e->getMessage(),
                ]);
            } catch (\Throwable $e) {
                if ($this->isRetryableMessage($e->getMessage())) {
                    $this->markRouteUnavailable($route, 'retryable');
                }

                $errors[] = $this->formatRouteError($route, $e->getMessage());
                Log::warning('[AI-LB] Ruta IA fallo y se intentara otra.', [
                    'route' => $route['id'],
                    'provider' => $route['provider'],
                    'model' => $route['model'],
                    'error' => $e->getMessage(),
                ]);
            }
        }

        throw new \RuntimeException('Se agotaron todas las rutas de IA. '.implode(' | ', $errors));
    }

    public function lastUsage(): ?array
    {
        return $this->lastUsage;
    }

    public function extractPdfTextWithGemini(string $fileContent, ?string $displayName = null): string
    {
        $routes = $this->limitRoutes(
            $this->geminiProfileRoutes('ocr_pdf'),
            (int) config('services.ai_load_balancer.ocr_max_attempts', 4)
        );

        if ($routes === []) {
            throw new \RuntimeException('No hay rutas Gemini disponibles para OCR.');
        }

        $cacheKey = 'doc_ocr_'.md5($fileContent);
        $base64Pdf = base64_encode($fileContent);

        return Cache::remember($cacheKey, now()->addDays(30), function () use ($routes, $base64Pdf, $displayName) {
            $lastError = 'OCR no disponible.';

            foreach ($routes as $route) {
                try {
                    $this->recordRequestMetrics($route);

                    $response = Http::timeout(90)
                        ->acceptJson()
                        ->post(
                            "https://generativelanguage.googleapis.com/v1beta/models/{$route['model']}:generateContent?key={$route['api_key']}",
                            [
                                'contents' => [[
                                    'parts' => [
                                        [
                                            'text' => 'Extrae el texto completo de este PDF. Devuelve solo texto plano en espanol, sin markdown, sin JSON y sin explicaciones. Conserva encabezados, tablas simples, valores clinicos, nombres, fechas y observaciones si aparecen. Si el archivo no contiene texto legible, responde vacio. Archivo: '.($displayName ?? 'documento.pdf'),
                                        ],
                                        [
                                            'inline_data' => [
                                                'mime_type' => 'application/pdf',
                                                'data' => $base64Pdf,
                                            ],
                                        ],
                                    ],
                                ]],
                                'generationConfig' => [
                                    'temperature' => 0,
                                ],
                            ]
                        );

                    if (! $response->successful()) {
                        $lastError = $response->body();

                        if ($this->isRetryableHttpStatus($response->status()) || $this->isRetryableMessage($lastError)) {
                            $this->markRouteUnavailable($route, (string) $response->status());
                        }

                        continue;
                    }

                    $raw = trim((string) $response->json('candidates.0.content.parts.0.text'));

                    if (blank($raw)) {
                        $lastError = 'Gemini OCR devolvio una respuesta vacia.';

                        continue;
                    }

                    $usage = $response->json('usageMetadata', []);
                    $this->lastUsage = [
                        'provider' => 'gemini',
                        'model' => $route['model'],
                        'route' => $route['id'],
                        'operation' => 'ocr_pdf',
                        'key_index' => $route['key_index'],
                        'available' => true,
                        'prompt_tokens' => $usage['promptTokenCount'] ?? null,
                        'output_tokens' => $usage['candidatesTokenCount'] ?? null,
                        'total_tokens' => $usage['totalTokenCount'] ?? null,
                    ];
                    $this->recordTokenMetrics(
                        $route,
                        $usage['promptTokenCount'] ?? null,
                        $usage['candidatesTokenCount'] ?? null,
                        $usage['totalTokenCount'] ?? null,
                    );

                    return $raw;
                } catch (ConnectionException $e) {
                    $lastError = $e->getMessage();
                    $this->markRouteUnavailable($route, 'connection');
                } catch (\Throwable $e) {
                    $lastError = $e->getMessage();

                    if ($this->isRetryableMessage($lastError)) {
                        $this->markRouteUnavailable($route, 'retryable');
                    }

                    Log::warning('[AI-LB] Gemini OCR fallo y se intentara otro modelo.', [
                        'route' => $route['id'],
                        'model' => $route['model'],
                        'error' => $lastError,
                    ]);
                }
            }

            Log::warning('[AI-LB] No se logro OCR con Gemini en ninguna ruta.', [
                'display_name' => $displayName,
                'error' => $lastError,
            ]);

            return '';
        });
    }

    public function geminiProfileModels(string $profile, ?string $preferredModel = null): array
    {
        return $this->geminiModelSequence($preferredModel, $profile);
    }

    protected function analysisRoutes(array $options = []): array
    {
        $profile = $options['profile'] ?? 'pdf_nativo';

        return collect($this->configuredAnalysisRoutes())
            ->filter(fn (array $route) => $route['enabled'])
            ->filter(fn (array $route) => $this->routeHasCredentials($route))
            ->flatMap(fn (array $route) => $this->expandRouteVariants($route, $profile))
            ->reject(fn (array $route) => $this->routeInCooldown($route))
            ->values()
            ->all();
    }

    protected function configuredAnalysisRoutes(): array
    {
        $routes = config('services.ai_load_balancer.analysis_routes', []);

        return collect($routes)
            ->map(function (array $route, int $index) {
                $normalized = [
                    'id' => $route['id'] ?? sprintf('%s:%s:%s', $route['provider'] ?? 'unknown', $route['model'] ?? 'default', $index),
                    'provider' => $route['provider'] ?? 'unknown',
                    'model' => $route['model'] ?? null,
                    'weight' => max(1, (int) ($route['weight'] ?? 1)),
                    'enabled' => (bool) ($route['enabled'] ?? true),
                ];
                $override = Cache::get('ai_lb:route_overrides', [])[$normalized['id']] ?? [];
                $normalized = array_merge($normalized, array_intersect_key($override, array_flip(['enabled', 'model', 'weight'])));
                $normalized['weight'] = max(1, (int) ($normalized['weight'] ?? 1));
                $normalized['enabled'] = (bool) ($normalized['enabled'] ?? true);

                $cooldown = Cache::get($this->cooldownCacheKey($normalized));

                return array_merge($normalized, [
                    'has_credentials' => $this->routeHasCredentials($normalized),
                    'cooldown_active' => $cooldown !== null,
                    'cooldown' => $cooldown,
                ]);
            })
            ->values()
            ->all();
    }

    protected function buildMonitorRow(array $route): array
    {
        $metrics = $this->routeMetrics($route);

        return [
            'tier' => $this->resolveTierLabel($route),
            'driver' => strtoupper((string) $route['provider']),
            'model' => (string) ($route['model'] ?? 'sin-modelo'),
            'rpm' => $metrics['rpm'],
            'rpd' => $metrics['rpd'],
            'tpm' => $metrics['tpm'],
            'tpd' => $metrics['tpd'],
        ];
    }

    protected function routeMetrics(array $route): array
    {
        $aggregateId = $this->metricsAggregateId($route);

        return [
            'rpm' => (int) Cache::get($this->metricsCacheKey($aggregateId, 'rpm'), 0),
            'rpd' => (int) Cache::get($this->metricsCacheKey($aggregateId, 'rpd'), 0),
            'tpm' => (int) Cache::get($this->metricsCacheKey($aggregateId, 'tpm'), 0),
            'tpd' => (int) Cache::get($this->metricsCacheKey($aggregateId, 'tpd'), 0),
        ];
    }

    protected function resolveTierLabel(array $route): string
    {
        return match ($route['provider']) {
            'groq' => in_array($route['model'], config('services.groq.free_models', []), true) ? 'Gratis' : 'Premium',
            'gemini' => 'Gratis',
            'cerebras' => 'Premium',
            default => 'General',
        };
    }

    protected function providerStatus(string $provider, array $configuredRoutes): array
    {
        $providerRoutes = array_values(array_filter($configuredRoutes, fn (array $route) => $route['provider'] === $provider));
        $cooldownReasons = array_values(array_filter(array_map(
            fn (array $route) => $route['cooldown']['reason'] ?? null,
            $providerRoutes
        )));
        $availableModels = match ($provider) {
            'gemini' => $this->geminiAvailableModels(),
            'groq' => config('services.groq.available_models', []),
            'cerebras' => config('services.cerebras.available_models', []),
            default => [],
        };
        $documentProfiles = $provider === 'gemini' ? $this->geminiDocumentProfiles($availableModels) : [];
        $rotationPlan = $provider === 'gemini' ? [
            'pdf_nativo' => $this->geminiModelSequence($providerRoutes[0]['model'] ?? null, 'pdf_nativo'),
            'ocr_pdf' => $this->geminiModelSequence($providerRoutes[0]['model'] ?? null, 'ocr_pdf'),
            'revision_agotamiento' => $this->geminiModelSequence($providerRoutes[0]['model'] ?? null, 'revision_agotamiento'),
        ] : [];

        return [
            'configured' => count($providerRoutes),
            'healthy' => count(array_filter($providerRoutes, fn (array $route) => $route['enabled'] && $route['has_credentials'] && ! $route['cooldown_active'])),
            'cooling_down' => count(array_filter($providerRoutes, fn (array $route) => $route['cooldown_active'])),
            'has_credentials' => count(array_filter($providerRoutes, fn (array $route) => $route['has_credentials'])) > 0,
            'credential_count' => $provider === 'gemini'
                ? count(array_values(array_filter(config('services.gemini.keys', []))))
                : (($provider === 'groq' ? filled(config('services.groq.api_key')) : ($provider === 'cerebras' ? filled(config('services.cerebras.api_key')) : false)) ? 1 : 0),
            'status_label' => $this->providerStatusLabel($provider, $providerRoutes, $cooldownReasons),
            'message' => $this->providerStatusMessage($provider, $providerRoutes, $cooldownReasons),
            'available_models' => $availableModels,
            'available_models_count' => count($availableModels),
            'document_profiles' => $documentProfiles,
            'rotation_plan' => $rotationPlan,
            'auto_rotation_message' => $provider === 'gemini'
                ? 'Gemini alterna automaticamente entre modelos del perfil activo y luego usa revision por agotamiento cuando detecta cuota, 429 o errores transitorios.'
                : ($provider === 'groq'
                    ? 'Groq participa como respaldo dentro del balanceador.'
                    : 'Cerebras participa como proveedor OpenAI-compatible dentro del balanceador.'),
        ];
    }

    protected function providerStatusLabel(string $provider, array $routes, array $cooldownReasons): string
    {
        if (empty($routes)) {
            return 'sin_rutas';
        }

        if (count(array_filter($routes, fn (array $route) => $route['has_credentials'])) === 0) {
            return 'sin_credenciales';
        }

        if ($this->providerIsRateLimited($cooldownReasons)) {
            return 'rate_limited';
        }

        if (count(array_filter($routes, fn (array $route) => $route['enabled'] && $route['has_credentials'] && ! $route['cooldown_active'])) > 0) {
            return 'operativo';
        }

        if (count(array_filter($routes, fn (array $route) => $route['cooldown_active'])) > 0) {
            return 'cooldown';
        }

        return 'configurado';
    }

    protected function providerStatusMessage(string $provider, array $routes, array $cooldownReasons): string
    {
        if (empty($routes)) {
            return 'No hay rutas configuradas para este proveedor.';
        }

        if (count(array_filter($routes, fn (array $route) => $route['has_credentials'])) === 0) {
            return $provider === 'gemini'
                ? 'Gemini no tiene API keys configuradas.'
                : ($provider === 'groq'
                    ? 'Groq no tiene API key configurada.'
                    : 'Cerebras no tiene API key configurada.');
        }

        if ($provider === 'gemini' && $this->providerIsRateLimited($cooldownReasons)) {
            return 'Gemini tiene credenciales configuradas, pero su estado actual indica cuota agotada o rate limit.';
        }

        if (count(array_filter($routes, fn (array $route) => $route['enabled'] && $route['has_credentials'] && ! $route['cooldown_active'])) > 0) {
            return 'Proveedor operativo y disponible para el balanceador.';
        }

        if (count(array_filter($routes, fn (array $route) => $route['cooldown_active'])) > 0) {
            return 'El proveedor está temporalmente en cooldown por errores transitorios recientes.';
        }

        return 'Proveedor configurado.';
    }

    protected function providerIsRateLimited(array $cooldownReasons): bool
    {
        foreach ($cooldownReasons as $reason) {
            if (in_array((string) $reason, ['429', 'retryable_body'], true)) {
                return true;
            }
        }

        return false;
    }

    protected function geminiAvailableModels(): array
    {
        $keys = array_values(array_filter(config('services.gemini.keys', [])));

        if ($keys === []) {
            return [];
        }

        return Cache::remember('ai_lb:gemini:available_models', now()->addMinutes(15), function () use ($keys) {
            foreach ($keys as $key) {
                try {
                    $response = Http::timeout((int) config('gemini.request_timeout', 60))
                        ->acceptJson()
                        ->get("https://generativelanguage.googleapis.com/v1beta/models?key={$key}");

                    if (! $response->successful()) {
                        continue;
                    }

                    return collect($response->json('models', []))
                        ->filter(fn (array $model) => in_array('generateContent', $model['supportedGenerationMethods'] ?? [], true))
                        ->pluck('name')
                        ->map(fn (string $name) => str_replace('models/', '', $name))
                        ->filter(fn (string $name) => str_starts_with($name, 'gemini-'))
                        ->values()
                        ->all();
                } catch (\Throwable) {
                    continue;
                }
            }

            return [];
        });
    }

    /**
     * @param  array<int, string>  $availableModels
     * @return array<string, array<int, string>>
     */
    protected function geminiDocumentProfiles(array $availableModels): array
    {
        $preferredProfiles = $this->geminiPreferredProfiles();

        $availableLookup = array_flip($availableModels);

        return collect($preferredProfiles)
            ->map(fn (array $models) => array_values(array_filter(
                $models,
                fn (string $model) => isset($availableLookup[$model])
            )))
            ->all();
    }

    protected function geminiModelSequence(?string $preferredModel, string $profile): array
    {
        $availableModels = $this->geminiAvailableModels();
        $availableLookup = array_flip($availableModels);
        $preferredProfiles = $this->geminiPreferredProfiles();
        $profileModels = $preferredProfiles[$profile] ?? [];
        $revisionModels = $preferredProfiles['revision_agotamiento'] ?? [];

        $sequence = collect([
            $preferredModel,
            ...$profileModels,
            ...($profile === 'revision_agotamiento' ? [] : $revisionModels),
        ])
            ->filter(fn ($model) => filled($model))
            ->map(fn ($model) => (string) $model)
            ->unique()
            ->values();

        if ($availableModels !== []) {
            $sequence = $sequence
                ->filter(fn (string $model) => isset($availableLookup[$model]))
                ->values();
        }

        return $sequence->all();
    }

    protected function expandRouteVariants(array $route, string $profile): array
    {
        if ($route['provider'] !== 'gemini') {
            return [[
                'id' => $route['id'],
                'provider' => $route['provider'],
                'model' => $route['model'],
                'weight' => $route['weight'],
            ]];
        }

        return $this->geminiProfileRoutes($profile, $route);
    }

    protected function geminiProfileRoutes(string $profile, ?array $baseRoute = null): array
    {
        $baseRoute ??= collect($this->configuredAnalysisRoutes())->firstWhere('provider', 'gemini');

        if (! $baseRoute || ! $this->routeHasCredentials($baseRoute)) {
            return [];
        }

        $keys = array_values(array_filter(config('services.gemini.keys', [])));
        $sequence = $this->geminiModelSequence($baseRoute['model'] ?? null, $profile);

        return collect($sequence)
            ->flatMap(function (string $model, int $modelIndex) use ($baseRoute, $keys, $profile) {
                return collect($keys)->map(function (string $apiKey, int $keyIndex) use ($baseRoute, $model, $modelIndex, $profile) {
                    return [
                        'id' => "{$baseRoute['id']}::{$profile}::{$modelIndex}::key{$keyIndex}",
                        'provider' => 'gemini',
                        'model' => $model,
                        'weight' => max(1, (int) ($baseRoute['weight'] ?? 1)),
                        'key_index' => $keyIndex,
                        'api_key' => $apiKey,
                    ];
                });
            })
            ->values()
            ->all();
    }

    protected function orderedRoutes(array $routes): array
    {
        if ($routes === []) {
            return [];
        }

        $groupedRoutes = [];

        foreach ($routes as $route) {
            $provider = (string) $route['provider'];
            $copies = min(10, max(1, (int) $route['weight']));

            if (! array_key_exists($provider, $groupedRoutes)) {
                $groupedRoutes[$provider] = [];
            }

            for ($i = 0; $i < $copies; $i++) {
                $groupedRoutes[$provider][] = $route;
            }
        }

        $providers = array_keys($groupedRoutes);
        if ($providers === []) {
            return [];
        }

        $providerCursor = Cache::increment('ai_lb:provider_cursor');
        $providerStart = $providerCursor % count($providers);
        $orderedProviders = array_values([
            ...array_slice($providers, $providerStart),
            ...array_slice($providers, 0, $providerStart),
        ]);

        $mixedRoutes = [];

        while (true) {
            $addedInRound = false;

            foreach ($orderedProviders as $provider) {
                if (($groupedRoutes[$provider] ?? []) === []) {
                    continue;
                }

                $mixedRoutes[] = array_shift($groupedRoutes[$provider]);
                $addedInRound = true;
            }

            if (! $addedInRound) {
                break;
            }
        }

        return array_values($mixedRoutes);
    }

    protected function mixedRotationPreview(string $profile): array
    {
        return collect($this->limitRoutes(
            $this->orderedRoutes($this->analysisRoutes(['profile' => $profile])),
            (int) config('services.ai_load_balancer.max_attempts', 6)
        ))
            ->take(8)
            ->map(fn (array $route) => [
                'provider' => $route['provider'],
                'model' => $route['model'],
            ])
            ->values()
            ->all();
    }

    protected function limitRoutes(array $routes, int $maxAttempts): array
    {
        if ($maxAttempts <= 0) {
            return $routes;
        }

        return array_values(array_slice($routes, 0, $maxAttempts));
    }

    protected function dispatchJsonRequest(array $route, string $prompt): array
    {
        return match ($route['provider']) {
            'gemini' => $this->dispatchGeminiJsonRequest($route, $prompt),
            'groq' => $this->dispatchOpenAiCompatibleRequest('groq', $route, $prompt),
            'cerebras' => $this->dispatchOpenAiCompatibleRequest('cerebras', $route, $prompt),
            default => throw new \RuntimeException("Proveedor de IA no soportado: {$route['provider']}"),
        };
    }

    protected function dispatchGeminiJsonRequest(array $route, string $prompt): array
    {
        if (blank($route['api_key'] ?? null)) {
            throw new \RuntimeException('No se ha configurado ninguna clave API de Gemini.');
        }

        $this->recordRequestMetrics($route);

        $response = Http::timeout((int) config('gemini.request_timeout', 60))
            ->acceptJson()
            ->post(
                "https://generativelanguage.googleapis.com/v1beta/models/{$route['model']}:generateContent?key={$route['api_key']}",
                [
                    'contents' => [[
                        'parts' => [[
                            'text' => $prompt,
                        ]],
                    ]],
                    'generationConfig' => [
                        'temperature' => 0.1,
                        'responseMimeType' => 'application/json',
                    ],
                ]
            );

        $response->throw();

        $payload = $response->json();
        $raw = trim((string) data_get($payload, 'candidates.0.content.parts.0.text', ''));
        $decoded = $this->decodeJson($raw);

        if (! is_array($decoded)) {
            throw new \RuntimeException('Gemini respondio JSON invalido.');
        }

        $usage = $payload['usageMetadata'] ?? [];
        $this->lastUsage = [
            'provider' => 'gemini',
            'model' => $route['model'],
            'route' => $route['id'],
            'key_index' => $route['key_index'] ?? null,
            'available' => true,
            'prompt_tokens' => $usage['promptTokenCount'] ?? null,
            'output_tokens' => $usage['candidatesTokenCount'] ?? null,
            'total_tokens' => $usage['totalTokenCount'] ?? null,
        ];
        $this->recordTokenMetrics(
            $route,
            $usage['promptTokenCount'] ?? null,
            $usage['candidatesTokenCount'] ?? null,
            $usage['totalTokenCount'] ?? null,
        );

        return $decoded;
    }

    protected function dispatchOpenAiCompatibleRequest(string $provider, array $route, string $prompt): array
    {
        $config = config("services.{$provider}");
        $apiKey = $config['api_key'] ?? null;

        if (blank($apiKey)) {
            throw new \RuntimeException("No hay una clave API configurada para {$provider}.");
        }

        $this->recordRequestMetrics($route);

        $request = Http::timeout((int) ($config['timeout'] ?? 60))
            ->acceptJson()
            ->withToken($apiKey);

        $response = $request->post(rtrim((string) ($config['base_url'] ?? ''), '/').'/chat/completions', [
            'model' => $route['model'] ?: ($config['model'] ?? null),
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Responde solo con JSON valido, sin markdown ni explicaciones.',
                ],
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
            'temperature' => 0.1,
            'response_format' => [
                'type' => 'json_object',
            ],
        ]);

        $response->throw();

        $payload = $response->json();
        $raw = trim((string) data_get($payload, 'choices.0.message.content', ''));
        $decoded = $this->decodeJson($raw);

        if (! is_array($decoded)) {
            throw new \RuntimeException("{$provider} respondio JSON invalido.");
        }

        $usage = $payload['usage'] ?? [];
        $this->lastUsage = [
            'provider' => $provider,
            'model' => $route['model'],
            'route' => $route['id'],
            'available' => true,
            'prompt_tokens' => $usage['prompt_tokens'] ?? null,
            'output_tokens' => $usage['completion_tokens'] ?? null,
            'total_tokens' => $usage['total_tokens'] ?? null,
        ];
        $this->recordTokenMetrics(
            $route,
            $usage['prompt_tokens'] ?? null,
            $usage['completion_tokens'] ?? null,
            $usage['total_tokens'] ?? null,
        );

        return $decoded;
    }

    protected function recordRequestMetrics(array $route): void
    {
        $aggregateId = $this->metricsAggregateId($route);

        $this->incrementMetric($aggregateId, 'rpm', 1, now()->copy()->endOfMinute());
        $this->incrementMetric($aggregateId, 'rpd', 1, now()->copy()->endOfDay());
    }

    protected function recordTokenMetrics(array $route, mixed $promptTokens, mixed $outputTokens, mixed $totalTokens): void
    {
        $aggregateId = $this->metricsAggregateId($route);
        $tokenTotal = $this->normalizeTokenCount($totalTokens);

        if ($tokenTotal === null) {
            $tokenTotal = ($this->normalizeTokenCount($promptTokens) ?? 0) + ($this->normalizeTokenCount($outputTokens) ?? 0);
        }

        if ($tokenTotal === null || $tokenTotal <= 0) {
            return;
        }

        $this->incrementMetric($aggregateId, 'tpm', $tokenTotal, now()->copy()->endOfMinute());
        $this->incrementMetric($aggregateId, 'tpd', $tokenTotal, now()->copy()->endOfDay());
    }

    protected function incrementMetric(string $aggregateId, string $bucket, int $amount, \Illuminate\Support\Carbon $expiresAt): void
    {
        if ($amount <= 0) {
            return;
        }

        $cacheKey = $this->metricsCacheKey($aggregateId, $bucket);
        Cache::add($cacheKey, 0, $expiresAt);
        Cache::increment($cacheKey, $amount);
    }

    protected function metricsAggregateId(array $route): string
    {
        $routeId = (string) ($route['id'] ?? 'unknown');
        $baseRouteId = str_contains($routeId, '::')
            ? explode('::', $routeId, 2)[0]
            : $routeId;

        return 'ai_lb:metrics:'.$baseRouteId;
    }

    protected function metricsCacheKey(string $aggregateId, string $bucket): string
    {
        return match ($bucket) {
            'rpm', 'tpm' => $aggregateId.':'.now()->format('YmdHi').':'.$bucket,
            'rpd', 'tpd' => $aggregateId.':'.now()->format('Ymd').':'.$bucket,
            default => $aggregateId.':'.$bucket,
        };
    }

    protected function normalizeTokenCount(mixed $value): ?int
    {
        if (! is_numeric($value)) {
            return null;
        }

        return max(0, (int) $value);
    }

    protected function decodeJson(string $raw): ?array
    {
        $raw = preg_replace('/^```json\s*/i', '', trim($raw));
        $raw = preg_replace('/\s*```$/i', '', $raw);

        $decoded = json_decode($raw, true);

        return json_last_error() === JSON_ERROR_NONE && is_array($decoded)
            ? $decoded
            : null;
    }

    protected function routeHasCredentials(array $route): bool
    {
        return match ($route['provider']) {
            'gemini' => ! empty(array_filter(config('services.gemini.keys', []))),
            'groq' => filled(config('services.groq.api_key')),
            'cerebras' => filled(config('services.cerebras.api_key')),
            default => false,
        };
    }

    protected function routeInCooldown(array $route): bool
    {
        return Cache::has($this->cooldownCacheKey($route));
    }

    protected function markRouteUnavailable(array $route, string $reason): void
    {
        Cache::put(
            $this->cooldownCacheKey($route),
            ['reason' => $reason, 'at' => now()->toIso8601String()],
            now()->addSeconds((int) config('services.ai_load_balancer.cooldown_seconds', 90))
        );
    }

    protected function cooldownCacheKey(array $route): string
    {
        return 'ai_lb:cooldown:'.$route['id'];
    }

    protected function cooldownReason(RequestException $e): ?string
    {
        $status = $e->response?->status();

        if ($this->isRetryableHttpStatus($status)) {
            return (string) ($status ?? 'retryable_http');
        }

        $body = (string) $e->response?->body();

        return $this->isRetryableMessage($body) ? 'retryable_body' : null;
    }

    protected function isRetryableHttpStatus(?int $status): bool
    {
        return in_array($status, [408, 409, 425, 429, 500, 502, 503, 504], true);
    }

    protected function isRetryableMessage(string $message): bool
    {
        $message = strtolower($message);

        foreach (['rate limit', 'too many requests', 'resource_exhausted', 'quota', 'temporarily unavailable', 'timeout'] as $needle) {
            if (str_contains($message, $needle)) {
                return true;
            }
        }

        return false;
    }

    protected function formatRouteError(array $route, string $error): string
    {
        return sprintf('%s/%s: %s', $route['provider'], $route['model'], trim($error));
    }
}
