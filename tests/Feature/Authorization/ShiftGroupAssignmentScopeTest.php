<?php

namespace Tests\Feature\Authorization;

use App\Models\ShiftSchedule;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ShiftGroupAssignmentScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigning_worker_only_closes_active_assignments_owned_by_logged_in_user(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $ownerSchedule = ShiftSchedule::create([
            'user_id' => $owner->id,
            'name' => 'Turno Owner',
            'color' => '#123456',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 0,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 7,
            'rest_days' => 7,
        ]);

        $newOwnerSchedule = ShiftSchedule::create([
            'user_id' => $owner->id,
            'name' => 'Turno Nuevo',
            'color' => '#654321',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 1,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 4,
            'rest_days' => 4,
        ]);

        $foreignSchedule = ShiftSchedule::create([
            'user_id' => $otherUser->id,
            'name' => 'Turno Ajeno',
            'color' => '#abcdef',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 0,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 5,
            'rest_days' => 2,
        ]);

        $worker = Worker::create([
            'rut' => '11.111.111-1',
            'name' => 'Trabajador Demo',
        ]);

        DB::table('shift_schedule_worker')->insert([
            [
                'shift_schedule_id' => $ownerSchedule->id,
                'worker_id' => $worker->id,
                'start_date' => '2026-03-01',
                'end_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'shift_schedule_id' => $foreignSchedule->id,
                'worker_id' => $worker->id,
                'start_date' => '2026-03-01',
                'end_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->actingAs($owner)->post(route('shifts.groups.assign', $newOwnerSchedule), [
            'worker_ids' => [$worker->id],
            'start_date' => '2026-03-10',
            'year' => 2026,
            'month' => 3,
        ])->assertRedirect();

        $this->assertDatabaseHas('shift_schedule_worker', [
            'shift_schedule_id' => $ownerSchedule->id,
            'worker_id' => $worker->id,
            'end_date' => '2026-03-09',
        ]);

        $this->assertDatabaseHas('shift_schedule_worker', [
            'shift_schedule_id' => $foreignSchedule->id,
            'worker_id' => $worker->id,
            'end_date' => null,
        ]);

        $this->assertDatabaseHas('shift_schedule_worker', [
            'shift_schedule_id' => $newOwnerSchedule->id,
            'worker_id' => $worker->id,
            'start_date' => '2026-03-10',
            'end_date' => null,
        ]);
    }

    public function test_unassigned_workers_only_excludes_active_assignments_from_logged_in_user(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $ownerSchedule = ShiftSchedule::create([
            'user_id' => $owner->id,
            'name' => 'Turno Owner',
            'color' => '#123456',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 0,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 7,
            'rest_days' => 7,
        ]);

        $foreignSchedule = ShiftSchedule::create([
            'user_id' => $otherUser->id,
            'name' => 'Turno Ajeno',
            'color' => '#abcdef',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 0,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 5,
            'rest_days' => 2,
        ]);

        $assignedToOwner = Worker::create([
            'rut' => '11.111.111-1',
            'name' => 'Asignado Owner',
            'nombres' => 'Asignado',
            'apellido_paterno' => 'Owner',
        ]);

        $assignedToOtherUser = Worker::create([
            'rut' => '22.222.222-2',
            'name' => 'Asignado Ajeno',
            'nombres' => 'Asignado',
            'apellido_paterno' => 'Ajeno',
        ]);

        DB::table('shift_schedule_worker')->insert([
            [
                'shift_schedule_id' => $ownerSchedule->id,
                'worker_id' => $assignedToOwner->id,
                'start_date' => '2026-03-01',
                'end_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'shift_schedule_id' => $foreignSchedule->id,
                'worker_id' => $assignedToOtherUser->id,
                'start_date' => '2026-03-01',
                'end_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->actingAs($owner)->get(route('shifts.groups.index', [
            'year' => 2026,
            'month' => 3,
        ]));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Shifts/Groups')
            ->where('unassignedWorkers', function ($workers) use ($assignedToOwner, $assignedToOtherUser) {
                $workerIds = collect($workers)->pluck('id');

                return ! $workerIds->contains($assignedToOwner->id)
                    && $workerIds->contains($assignedToOtherUser->id);
            })
        );
    }
}
