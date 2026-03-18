<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class GroqChatService
{
    /**
     * @param  array<int, array<string, string>>  $messages
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     * @throws ConnectionException
     * @throws RequestException
     */
    public function createChatCompletion(array $messages, ?string $model = null): array
    {
        $apiKey = config('services.groq.api_key');

        if (blank($apiKey)) {
            throw new \RuntimeException('No hay una clave API de Groq configurada en GROQ_API_KEY.');
        }

        $response = Http::timeout((int) config('services.groq.timeout', 60))
            ->acceptJson()
            ->withToken($apiKey)
            ->post(config('services.groq.base_url').'/chat/completions', [
                'model' => $model ?: config('services.groq.model', 'openai/gpt-oss-120b'),
                'messages' => $messages,
            ]);

        $response->throw();

        return $response->json();
    }

    public function simplePrompt(string $prompt, ?string $model = null): array
    {
        return $this->createChatCompletion([
            [
                'role' => 'user',
                'content' => $prompt,
            ],
        ], $model);
    }

    public function extractAssistantText(array $payload): string
    {
        return trim((string) data_get($payload, 'choices.0.message.content', ''));
    }
}
