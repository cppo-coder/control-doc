<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PhoneDirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_phone_directory_filters_results_server_side(): void
    {
        $user = User::factory()->create();
        Role::firstOrCreate(['name' => 'auditor', 'guard_name' => 'web']);
        $user->assignRole('auditor');

        Worker::create([
            'rut' => '11.111.111-1',
            'name' => 'Juan Perez',
            'nombres' => 'Juan',
            'apellido_paterno' => 'Perez',
            'apellido_materno' => 'Rojas',
            'phone' => '+56911111111',
        ]);

        Worker::create([
            'rut' => '22.222.222-2',
            'name' => 'Maria Soto',
            'nombres' => 'Maria',
            'apellido_paterno' => 'Soto',
            'apellido_materno' => 'Diaz',
            'phone' => '+56922222222',
        ]);

        $response = $this->actingAs($user)->get(route('workers.phone-directory', ['search' => 'Juan']));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Workers/PhoneDirectory')
            ->where('filters.search', 'Juan')
            ->has('workers.data', 1)
            ->where('workers.data.0.nombres', 'Juan')
        );
    }
}
