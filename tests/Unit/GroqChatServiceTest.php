<?php

namespace Tests\Unit;

use App\Services\GroqChatService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GroqChatServiceTest extends TestCase
{
    public function test_it_sends_a_chat_completion_request_to_groq(): void
    {
        config()->set('services.groq.api_key', 'test-groq-key');
        config()->set('services.groq.base_url', 'https://api.groq.com/openai/v1');
        config()->set('services.groq.model', 'openai/gpt-oss-120b');
        config()->set('services.groq.timeout', 60);

        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => 'Fast inference improves responsiveness.',
                    ],
                ]],
            ], 200),
        ]);

        $service = app(GroqChatService::class);
        $payload = $service->simplePrompt('Explain fast AI inference.');

        $this->assertSame('Fast inference improves responsiveness.', $service->extractAssistantText($payload));

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.groq.com/openai/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer test-groq-key')
                && $request['model'] === 'openai/gpt-oss-120b'
                && $request['messages'][0]['role'] === 'user'
                && $request['messages'][0]['content'] === 'Explain fast AI inference.';
        });
    }

    public function test_it_requires_an_api_key(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('No hay una clave API de Groq configurada en GROQ_API_KEY.');

        config()->set('services.groq.api_key', null);

        app(GroqChatService::class)->simplePrompt('Hola');
    }
}
