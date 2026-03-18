<?php

$groqFreeModels = [
    'openai/gpt-oss-120b',
    'groq/compound-mini',
    'openai/gpt-oss-20b',
    'llama-3.1-8b-instant',
];

$configuredGroqModels = array_values(array_filter(array_map(
    'trim',
    explode(',', env('AI_LB_GROQ_MODELS', implode(',', $groqFreeModels)))
)));

$groqAnalysisRoutes = array_map(
    fn (string $model, int $index) => [
        'id' => "groq-free-{$index}",
        'provider' => 'groq',
        'model' => $model,
        'weight' => (int) env('AI_LB_GROQ_WEIGHT', 30),
        'enabled' => env('AI_LB_GROQ_ENABLED', true),
    ],
    $configuredGroqModels,
    array_keys($configuredGroqModels)
);

$configuredCerebrasModels = array_values(array_filter(array_map(
    'trim',
    explode(',', env('AI_LB_CEREBRAS_MODELS', env('CEREBRAS_MODEL', 'llama-3.3-70b'))))
));

$cerebrasAnalysisRoutes = array_map(
    fn (string $model, int $index) => [
        'id' => "cerebras-{$index}",
        'provider' => 'cerebras',
        'model' => $model,
        'weight' => (int) env('AI_LB_CEREBRAS_WEIGHT', 20),
        'enabled' => env('AI_LB_CEREBRAS_ENABLED', true),
    ],
    $configuredCerebrasModels,
    array_keys($configuredCerebrasModels)
);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gemini' => [
        'keys' => array_map('trim', explode(',', env('GEMINI_API_KEYS', env('GEMINI_API_KEY')))),
    ],

    'groq' => [
        'api_key' => env('GROQ_API_KEY'),
        'base_url' => rtrim(env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'), '/'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
        'timeout' => (int) env('GROQ_TIMEOUT', 60),
        'available_models' => [
            'llama-3.1-8b-instant',
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'groq/compound',
            'groq/compound-mini',
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'qwen/qwen3-32b',
        ],
        'free_models' => [
            ...$groqFreeModels,
        ],
    ],

    'cerebras' => [
        'api_key' => env('CEREBRAS_API_KEY'),
        'base_url' => rtrim(env('CEREBRAS_BASE_URL', 'https://api.cerebras.ai/v1'), '/'),
        'model' => env('CEREBRAS_MODEL', 'qwen-3-235b-a22b-instruct-2507'),
        'timeout' => (int) env('CEREBRAS_TIMEOUT', 60),
        'available_models' => [
            'qwen-3-235b-a22b-instruct-2507',
            'llama3.1-8b',
        ],
    ],

    'ai_load_balancer' => [
        'strategy' => env('AI_LB_STRATEGY', 'round_robin'),
        'cooldown_seconds' => (int) env('AI_LB_COOLDOWN_SECONDS', 90),
        'max_attempts' => (int) env('AI_LB_MAX_ATTEMPTS', 6),
        'ocr_max_attempts' => (int) env('AI_LB_OCR_MAX_ATTEMPTS', 4),
        'analysis_routes' => [
            ...$cerebrasAnalysisRoutes,
            [
                'id' => 'gemini-primary',
                'provider' => 'gemini',
                'model' => env('AI_LB_GEMINI_MODEL', 'gemini-2.0-flash-lite'),
                'weight' => (int) env('AI_LB_GEMINI_WEIGHT', 50),
                'enabled' => env('AI_LB_GEMINI_ENABLED', true),
            ],
            ...$groqAnalysisRoutes,
        ],
    ],

];
