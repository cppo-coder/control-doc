<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AiLoadBalancerService;
use App\Services\NotebookLMAuthStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminAiStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_ai_status_page(): void
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
                ];
            }
        });

        $this->instance(AiLoadBalancerService::class, new class extends AiLoadBalancerService
        {
            public function status(): array
            {
                return [
                    'strategy' => 'round_robin',
                    'cooldown_seconds' => 90,
                    'summary' => [
                        'configured' => 2,
                        'enabled' => 2,
                        'healthy' => 1,
                        'cooling_down' => 1,
                        'missing_credentials' => 0,
                    ],
                    'routes' => [
                        [
                            'id' => 'groq:test:0',
                            'provider' => 'groq',
                            'model' => 'test',
                            'weight' => 1,
                            'enabled' => true,
                            'has_credentials' => true,
                            'cooldown_active' => false,
                            'cooldown' => null,
                        ],
                    ],
                    'last_usage' => null,
                ];
            }
        });

        $this->actingAs($user)
            ->get(route('admin.ai-status.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/AiStatus')
                ->where('notebooklmStatus.status', 'valid')
                ->where('aiBalancerStatus.strategy', 'round_robin')
                ->where('aiBalancerStatus.summary.healthy', 1)
            );
    }

    public function test_non_admin_users_cannot_view_ai_status_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('admin.ai-status.index'))
            ->assertForbidden();
    }

    public function test_admin_can_update_a_route_from_admin_panel(): void
    {
        $user = User::factory()->create();
        Role::findOrCreate('admin');
        $user->assignRole('admin');

        $this->instance(AiLoadBalancerService::class, new class extends AiLoadBalancerService
        {
            public function updateRoute(string $id, array $attributes): array
            {
                return [
                    'strategy' => 'round_robin',
                    'summary' => ['healthy' => 2],
                    'routes' => [[
                        'id' => $id,
                        'provider' => 'gemini',
                        'model' => $attributes['model'] ?? 'gemini-2.5-flash',
                        'weight' => 50,
                        'enabled' => $attributes['enabled'] ?? true,
                        'has_credentials' => true,
                        'cooldown_active' => false,
                        'cooldown' => null,
                    ]],
                ];
            }
        });

        $this->actingAs($user)
            ->postJson(route('admin.ai-status.routes.update'), [
                'id' => 'gemini-primary',
                'model' => 'gemini-2.5-flash',
            ])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'ai_balancer' => [
                    'routes' => [
                        ['id' => 'gemini-primary', 'model' => 'gemini-2.5-flash'],
                    ],
                ],
            ]);
    }
}
