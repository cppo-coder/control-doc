<?php

namespace App\Http\Controllers;

use App\Models\ShiftSchedule;
use App\Models\Worker;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ShiftGroupController extends Controller
{
    public function index(Request $request)
    {
        $year = $request->query('year', now()->year);
        $month = $request->query('month', now()->month);

        $date = Carbon::createFromDate($year, $month, 1);
        $startOfMonth = $date->copy()->startOfMonth()->format('Y-m-d');
        $endOfMonth = $date->copy()->endOfMonth()->format('Y-m-d');

        // Fetch groups intersecting this month
        $schedules = ShiftSchedule::where('user_id', auth()->id())
            ->where(function ($q) use ($startOfMonth) {
                $q->whereNull('end_date')
                  ->orWhere('end_date', '>=', $startOfMonth);
            })
            ->where('start_date', '<=', $endOfMonth)
            ->with(['workers' => function ($query) {
                // Only active workers in the group view
                $query->select('workers.id', 'nombres', 'apellido_paterno', 'apellido_materno', 'rut', 'position')
                    ->wherePivot('end_date', null);
            }])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        // ONLY workers with NO active assignment (end_date is null) are "unassigned"
        $assignedWorkerIds = DB::table('shift_schedule_worker')
            ->whereNull('end_date')
            ->pluck('worker_id')
            ->toArray();

        $unassignedWorkers = Worker::select('id', 'nombres', 'apellido_paterno', 'apellido_materno', 'rut', 'position')
            ->whereNotIn('id', $assignedWorkerIds)
            ->orderBy('nombres')
            ->get();

        $globalStartDateStr = ShiftSchedule::where('user_id', auth()->id())->min('start_date');
        $globalStartDate = $globalStartDateStr ? Carbon::parse($globalStartDateStr) : now();

        $maxDate = now()->addMonths(3);

        return Inertia::render('Shifts/Groups', [
            'year' => (int)$year,
            'month' => (int)$month,
            'schedules' => $schedules,
            'unassignedWorkers' => $unassignedWorkers,
            'minYear' => $globalStartDate->year,
            'minMonth' => $globalStartDate->month,
            'maxYear' => $maxDate->year,
            'maxMonth' => $maxDate->month,
        ]);
    }

    public function assignWorkers(Request $request, ShiftSchedule $schedule)
    {
        $request->validate([
            'worker_ids' => 'required|array',
            'worker_ids.*' => 'exists:workers,id',
            'start_date' => 'required|date',
        ]);

        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        $startDate = $request->start_date;
        $yesterdayOfStart = date('Y-m-d', strtotime($startDate . ' -1 day'));

        // End previous active assignments for these workers
        DB::table('shift_schedule_worker')
            ->whereIn('worker_id', $request->worker_ids)
            ->whereNull('end_date')
            ->update(['end_date' => $yesterdayOfStart]);

        // Create new assignments starting on the selected date
        foreach ($request->worker_ids as $workerId) {
            $schedule->workers()->attach($workerId, [
                'start_date' => $startDate,
                'end_date'   => null,
            ]);
        }

        return redirect()->back();
    }

    public function removeWorker(Request $request, ShiftSchedule $schedule, Worker $worker)
    {
        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        $schedule->workers()->detach($worker->id);

        return redirect()->back();
    }
}
