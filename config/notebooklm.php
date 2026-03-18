<?php

return [
    'account_email' => env('NOTEBOOKLM_ACCOUNT_EMAIL'),

    /*
    |--------------------------------------------------------------------------
    | Runtime Home
    |--------------------------------------------------------------------------
    |
    | Directorio base usado por el worker para almacenar la sesion autenticada
    | del MCP de NotebookLM. Dentro de este HOME se usa .config/notebooklm-mcp.
    |
    */
    'runtime_home' => env('NOTEBOOKLM_RUNTIME_HOME', storage_path('app/notebooklm-runtime')),

    'python_bin' => env('NOTEBOOKLM_PYTHON_BIN'),

    'status_cache_seconds' => (int) env('NOTEBOOKLM_STATUS_CACHE_SECONDS', 60),

    'renewal_worker_url' => env('NOTEBOOKLM_RENEWAL_WORKER_URL', 'http://127.0.0.1:4318/capture'),

    'renewal_worker_token' => env('NOTEBOOKLM_RENEWAL_WORKER_TOKEN'),

    'renewal_worker_timeout_seconds' => (int) env('NOTEBOOKLM_RENEWAL_WORKER_TIMEOUT_SECONDS', 90),

    'renewal_browser' => env('NOTEBOOKLM_RENEWAL_BROWSER', 'chrome'),
];
