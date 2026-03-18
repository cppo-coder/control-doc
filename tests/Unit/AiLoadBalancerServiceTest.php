<?php

namespace Tests\Unit;

use App\Services\AiLoadBalancerService;
use App\Services\DocumentAnalysisService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiLoadBalancerServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_it_falls_back_to_groq_after_gemini_rate_limit(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.ai_load_balancer.cooldown_seconds', 120);
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.0-flash-lite', 'weight' => 1, 'enabled' => true],
            ['provider' => 'groq', 'model' => 'openai/gpt-oss-120b', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.0-flash-lite'], now()->addMinutes(15));
        Cache::put('ai_lb:analysis_cursor', -1);
        Cache::put('ai_lb:provider_cursor', -1);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'error' => ['message' => 'RESOURCE_EXHAUSTED'],
            ], 429),
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'es_examen_salud' => true,
                            'nivel_alerta' => 'clean',
                        ], JSON_THROW_ON_ERROR),
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 110,
                    'completion_tokens' => 45,
                    'total_tokens' => 155,
                ],
            ], 200),
        ]);

        $service = app(AiLoadBalancerService::class);
        $result = $service->analyzeJson('Devuelve JSON.');

        $this->assertTrue($result['es_examen_salud']);
        $this->assertSame('groq', $service->lastUsage()['provider']);
        $this->assertTrue(Cache::has('ai_lb:cooldown:gemini-primary::pdf_nativo::0::key0'));
        Http::assertSentCount(2);
    }

    public function test_it_rotates_between_gemini_models_before_falling_back_to_groq(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.ai_load_balancer.cooldown_seconds', 120);
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.5-flash', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.5-flash', 'gemini-2.5-pro'], now()->addMinutes(15));
        Cache::put('ai_lb:analysis_cursor', -1);
        Cache::put('ai_lb:provider_cursor', -1);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => function ($request) {
                if (str_contains($request->url(), 'models/gemini-2.5-flash:generateContent')) {
                    return Http::response([
                        'error' => ['message' => 'RESOURCE_EXHAUSTED'],
                    ], 429);
                }

                if (str_contains($request->url(), 'models/gemini-2.5-pro:generateContent')) {
                    return Http::response([
                        'candidates' => [[
                            'content' => [
                                'parts' => [[
                                    'text' => json_encode([
                                        'es_examen_salud' => true,
                                        'nivel_alerta' => 'clean',
                                    ], JSON_THROW_ON_ERROR),
                                ]],
                            ],
                        ]],
                        'usageMetadata' => [
                            'promptTokenCount' => 120,
                            'candidatesTokenCount' => 40,
                            'totalTokenCount' => 160,
                        ],
                    ], 200);
                }

                return Http::response(['error' => ['message' => 'unexpected']], 500);
            },
        ]);

        $service = app(AiLoadBalancerService::class);
        $result = $service->analyzeJson('Devuelve JSON.', ['profile' => 'pdf_nativo']);

        $this->assertTrue($result['es_examen_salud']);
        $this->assertSame('gemini', $service->lastUsage()['provider']);
        $this->assertSame('gemini-2.5-pro', $service->lastUsage()['model']);
        $this->assertTrue(Cache::has('ai_lb:cooldown:gemini-primary::pdf_nativo::0::key0'));
        Http::assertSentCount(2);
    }

    public function test_it_alternates_between_gemini_and_groq_before_using_next_gemini_model(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.ai_load_balancer.cooldown_seconds', 120);
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.5-flash', 'weight' => 1, 'enabled' => true],
            ['id' => 'groq-free-0', 'provider' => 'groq', 'model' => 'openai/gpt-oss-120b', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.5-flash', 'gemini-2.5-pro'], now()->addMinutes(15));
        Cache::put('ai_lb:provider_cursor', -1);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => function ($request) {
                if (str_contains($request->url(), 'models/gemini-2.5-flash:generateContent')) {
                    return Http::response([
                        'error' => ['message' => 'RESOURCE_EXHAUSTED'],
                    ], 429);
                }

                if (str_contains($request->url(), 'models/gemini-2.5-pro:generateContent')) {
                    return Http::response([
                        'candidates' => [[
                            'content' => [
                                'parts' => [[
                                    'text' => json_encode([
                                        'es_examen_salud' => true,
                                        'nivel_alerta' => 'clean',
                                    ], JSON_THROW_ON_ERROR),
                                ]],
                            ],
                        ]],
                    ], 200);
                }

                return Http::response(['error' => ['message' => 'unexpected']], 500);
            },
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'es_examen_salud' => true,
                            'nivel_alerta' => 'clean',
                        ], JSON_THROW_ON_ERROR),
                    ],
                ]],
            ], 200),
        ]);

        $service = app(AiLoadBalancerService::class);
        $result = $service->analyzeJson('Devuelve JSON.', ['profile' => 'pdf_nativo']);

        $this->assertTrue($result['es_examen_salud']);
        $this->assertSame('groq', $service->lastUsage()['provider']);
        Http::assertSentCount(2);

        $recorded = Http::recorded()->map(fn (array $entry) => $entry[0]->url())->values()->all();

        $this->assertStringContainsString('models/gemini-2.5-flash:generateContent', $recorded[0]);
        $this->assertSame('https://api.groq.com/openai/v1/chat/completions', $recorded[1]);
    }

    public function test_it_skips_routes_in_cooldown(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.0-flash-lite', 'weight' => 1, 'enabled' => true],
            ['provider' => 'groq', 'model' => 'openai/gpt-oss-120b', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.0-flash-lite'], now()->addMinutes(15));
        Cache::put('ai_lb:analysis_cursor', -1);

        Cache::put('ai_lb:cooldown:gemini-primary::pdf_nativo::0::key0', ['reason' => '429'], now()->addMinute());

        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => '{"ok":true}',
                    ],
                ]],
            ], 200),
        ]);

        $result = app(AiLoadBalancerService::class)->analyzeJson('Devuelve JSON.');

        $this->assertTrue($result['ok']);

        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.groq.com/openai/v1/chat/completions');
    }

    public function test_it_limits_total_attempts_to_avoid_long_retry_loops(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.ai_load_balancer.max_attempts', 3);
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.5-flash', 'weight' => 1, 'enabled' => true],
            ['id' => 'groq-free-0', 'provider' => 'groq', 'model' => 'openai/gpt-oss-120b', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.5-flash', 'gemini-2.5-pro'], now()->addMinutes(15));
        Cache::put('ai_lb:provider_cursor', -1);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'error' => ['message' => 'RESOURCE_EXHAUSTED'],
            ], 429),
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'error' => ['message' => 'Rate limit reached'],
            ], 429),
        ]);

        try {
            app(AiLoadBalancerService::class)->analyzeJson('Devuelve JSON.', ['profile' => 'pdf_nativo']);
            $this->fail('Se esperaba una RuntimeException por agotamiento de rutas.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Se agotaron todas las rutas de IA.', $e->getMessage());
        }

        Http::assertSentCount(3);
    }

    public function test_medical_post_processing_flags_presuntamente_positivo_as_detected(): void
    {
        $service = app(DocumentAnalysisService::class);
        $method = new \ReflectionMethod($service, 'enforceMedicalRules');
        $method->setAccessible(true);

        $result = $method->invoke($service, [
            'es_examen_salud' => true,
            'trabajador' => 'MAXIMILIANO EDWARDS ANTONIO ROJAS MORALES',
            'trabajador_rut' => '21866157-2',
            'drogas' => [
                'detectado' => false,
                'sustancias' => [],
                'alerta' => false,
                'critico' => false,
                'detalle' => 'Resultado presuntamente positivo de cocaína; se sugiere confirmación con técnica cuantitativa.',
            ],
            'imc' => [
                'valor' => 26.01,
                'categoria' => 'Sobrepeso',
                'alerta' => false,
                'critico' => false,
                'detalle' => 'Peso 93.9 kg, altura 1.90 m',
            ],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'clean',
        ], 'COCAINA Presuntamente Positivo. Test para cocaina, presuntamente positivo. Persona niega consumo.');

        $this->assertTrue($result['drogas']['detectado']);
        $this->assertTrue($result['drogas']['alerta']);
        $this->assertTrue($result['drogas']['critico']);
        $this->assertContains('cocaina', $result['drogas']['sustancias']);
        $this->assertSame('critical', $result['nivel_alerta']);
    }

    public function test_status_reports_real_request_and_token_metrics(): void
    {
        config()->set('services.gemini.keys', ['test-gemini-key']);
        config()->set('services.ai_load_balancer.analysis_routes', [
            ['id' => 'gemini-primary', 'provider' => 'gemini', 'model' => 'gemini-2.5-pro', 'weight' => 1, 'enabled' => true],
        ]);
        Cache::put('ai_lb:gemini:available_models', ['gemini-2.5-pro'], now()->addMinutes(15));

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'text' => json_encode([
                                'es_examen_salud' => true,
                                'nivel_alerta' => 'clean',
                            ], JSON_THROW_ON_ERROR),
                        ]],
                    ],
                ]],
                'usageMetadata' => [
                    'promptTokenCount' => 90,
                    'candidatesTokenCount' => 30,
                    'totalTokenCount' => 120,
                ],
            ], 200),
        ]);

        $service = app(AiLoadBalancerService::class);
        $service->analyzeJson('Devuelve JSON.');
        $status = $service->status();
        $geminiRow = collect($status['monitor']['rows'])->firstWhere('driver', 'GEMINI');

        $this->assertNotNull($geminiRow);
        $this->assertSame(1, $geminiRow['rpm']);
        $this->assertSame(1, $geminiRow['rpd']);
        $this->assertSame(120, $geminiRow['tpm']);
        $this->assertSame(120, $geminiRow['tpd']);
    }
}
