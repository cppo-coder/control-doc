<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMSessionRenewalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class NotebookLMStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_endpoint_returns_service_unavailable_when_cookie_requires_renewal(): void
    {
        $user = User::factory()->create();
        Role::findOrCreate('admin');
        $user->assignRole('admin');

        $this->instance(NotebookLMAuthStatusService::class, new class extends NotebookLMAuthStatusService
        {
            public function status(bool $fresh = false): array
            {
                return [
                    'status' => 'expired',
                    'ok' => false,
                    'message' => 'La sesion de NotebookLM requiere renovacion.',
                    'renewal_required' => true,
                    'validation_error' => '401 Unauthorized',
                ];
            }
        });

        $this->actingAs($user)
            ->getJson(route('notebooklm.status'))
            ->assertStatus(503)
            ->assertJson([
                'success' => true,
                'notebooklm' => [
                    'status' => 'expired',
                    'renewal_required' => true,
                ],
            ]);
    }

    public function test_status_endpoint_returns_ok_when_session_is_valid(): void
    {
        $user = User::factory()->create();
        Role::findOrCreate('admin');
        $user->assignRole('admin');

        $this->instance(NotebookLMAuthStatusService::class, new class extends NotebookLMAuthStatusService
        {
            public function status(bool $fresh = false): array
            {
                return [
                    'status' => 'valid',
                    'ok' => true,
                    'message' => 'Sesion NotebookLM valida.',
                    'renewal_required' => false,
                ];
            }
        });

        $this->actingAs($user)
            ->getJson(route('notebooklm.status'))
            ->assertOk()
            ->assertJson([
                'success' => true,
                'notebooklm' => [
                    'status' => 'valid',
                    'renewal_required' => false,
                ],
            ]);
    }

    public function test_status_endpoint_is_forbidden_for_non_admin_users(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('notebooklm.status'))
            ->assertForbidden();
    }

    public function test_import_endpoint_rejects_invalid_cookie_payload(): void
    {
        $user = User::factory()->create();
        Role::findOrCreate('admin');
        $user->assignRole('admin');

        $this->actingAs($user)
            ->postJson(route('notebooklm.import'), [
                'cookie_header' => 'SID=short',
                'request_url' => 'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?f.sid=123',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cookie_header']);
    }

    public function test_renew_endpoint_returns_the_worker_result_for_admin_users(): void
    {
        $user = User::factory()->create();
        Role::findOrCreate('admin');
        $user->assignRole('admin');

        $this->instance(NotebookLMSessionRenewalService::class, new class extends NotebookLMSessionRenewalService
        {
            public function __construct() {}

            public function renew(): array
            {
                return [
                    'success' => true,
                    'message' => 'Sesion de NotebookLM renovada automaticamente.',
                    'notebooklm' => [
                        'status' => 'valid',
                        'ok' => true,
                    ],
                ];
            }
        });

        $this->actingAs($user)
            ->postJson(route('notebooklm.renew'))
            ->assertOk()
            ->assertJson([
                'success' => true,
                'notebooklm' => [
                    'status' => 'valid',
                ],
            ]);
    }
}
