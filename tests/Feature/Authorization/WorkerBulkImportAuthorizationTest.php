<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class WorkerBulkImportAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_without_management_role_cannot_bulk_import_workers(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('workers.bulk-store'), [
            'workers' => [[
                'nombres' => 'Juan',
                'apellido_paterno' => 'Perez',
            ]],
        ]);

        $response->assertForbidden();
    }

    public function test_supervisor_can_bulk_import_workers(): void
    {
        $user = User::factory()->create();
        Role::firstOrCreate(['name' => 'supervisor', 'guard_name' => 'web']);
        $user->assignRole('supervisor');

        $response = $this->actingAs($user)->post(route('workers.bulk-store'), [
            'workers' => [[
                'nacionalidad' => 'Chilena',
                'rut' => '12.345.678-5',
                'nombres' => 'Juan',
                'apellido_paterno' => 'Perez',
                'apellido_materno' => 'Gomez',
                'email' => 'juan@example.com',
            ]],
        ]);

        $response->assertRedirect(route('workers.index'));

        $this->assertDatabaseHas('workers', [
            'rut' => '12.345.678-5',
            'nombres' => 'Juan',
            'apellido_paterno' => 'Perez',
        ]);
    }
}
