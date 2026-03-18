<?php

namespace Tests\Feature\Authorization;

use App\Models\ShiftSchedule;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShiftScheduleAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_cannot_update_days_for_another_users_schedule(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();

        $schedule = ShiftSchedule::create([
            'user_id' => $owner->id,
            'name' => 'Turno A',
            'color' => '#123456',
            'year' => 2026,
            'month' => 3,
            'sort_order' => 0,
            'start_date' => '2026-03-01',
            'end_date' => null,
            'work_days' => 7,
            'rest_days' => 7,
        ]);

        $worker = Worker::create([
            'rut' => '11.111.111-1',
            'name' => 'Trabajador Demo',
        ]);

        $response = $this
            ->actingAs($intruder)
            ->post(route('shifts.days.update'), [
                'days' => [[
                    'shift_schedule_id' => $schedule->id,
                    'worker_id' => $worker->id,
                    'date' => '2026-03-15',
                    'type' => 'trabajo',
                    'note' => 'Intento ajeno',
                ]],
            ]);

        $response->assertForbidden();

        $this->assertDatabaseCount('shift_days', 0);
    }
}
