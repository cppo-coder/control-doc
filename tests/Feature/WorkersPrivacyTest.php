<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class WorkersPrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_read_only_role_does_not_receive_sensitive_worker_fields_or_edit_payload(): void
    {
        $user = User::factory()->create();
        Role::firstOrCreate(['name' => 'auditor', 'guard_name' => 'web']);
        $user->assignRole('auditor');

        $worker = Worker::create([
            'rut' => '11.111.111-1',
            'name' => 'Trabajador Demo',
            'nombres' => 'Trabajador',
            'apellido_paterno' => 'Demo',
            'apellido_materno' => 'Uno',
            'cta_bancaria' => '12345678',
            'beneficiario_swift' => 'ABCDEFGH',
            'phone' => '+56911111111',
            'email' => 'demo@example.com',
        ]);

        $response = $this->actingAs($user)->get(route('workers.index', ['id' => $worker->id]));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Workers/Index')
            ->where('selectedWorker', null)
            ->has('workers.data', 1)
            ->has('workers.data.0', fn (Assert $workerProp) => $workerProp
                ->where('id', $worker->id)
                ->missing('cta_bancaria')
                ->missing('beneficiario_swift')
                ->etc()
            )
        );
    }
}
