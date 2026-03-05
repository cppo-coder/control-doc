<?php

namespace App\Http\Controllers;

use App\Models\ShiftDay;
use App\Models\ShiftSchedule;
use App\Models\Worker;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ShiftScheduleController extends Controller
{
    public function index(Request $request)
    {
        $year = $request->query('year', now()->year);
        $month = $request->query('month', now()->month);

        $date = Carbon::createFromDate($year, $month, 1);
        $date2 = $date->copy()->addMonth();
        $date3 = $date->copy()->addMonths(2);

        $startOfRange = $date->copy()->startOfMonth()->format('Y-m-d');
        $endOfRange = $date3->copy()->endOfMonth()->format('Y-m-d');

        // Obtain all schedules that overlap with this 3-month range
        $schedules = ShiftSchedule::where('user_id', auth()->id())
            ->where(function ($q) use ($startOfRange) {
                $q->whereNull('end_date')
                  ->orWhere('end_date', '>=', $startOfRange);
            })
            ->where('start_date', '<=', $endOfRange)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        // If no schedules exist, we might want to auto-create defaults or let user create them, 
        // we will let the user create them in the view.

        $scheduleIds = $schedules->pluck('id');

        // Fetch all assigned days for these schedules
        $shiftDays = ShiftDay::whereIn('shift_schedule_id', $scheduleIds)
            ->whereBetween('date', [$startOfRange, $endOfRange])
            ->get();

        // Also we must load the workers explicitly assigned to each schedule
        // by pre-loading the workers relationship
        // Load workers who were in the schedule during the visible range
        $schedules->load(['workers' => function ($query) use ($startOfRange, $endOfRange) {
            $query->select('workers.id', 'nombres', 'apellido_paterno', 'apellido_materno', 'rut', 'position')
                ->where(function($q) use ($startOfRange, $endOfRange) {
                    $q->where(function($q2) use ($startOfRange) {
                        $q2->whereNull('shift_schedule_worker.end_date')
                           ->orWhere('shift_schedule_worker.end_date', '>=', $startOfRange);
                    })->where(function($q2) use ($endOfRange) {
                        $q2->whereNull('shift_schedule_worker.start_date')
                           ->orWhere('shift_schedule_worker.start_date', '<=', $endOfRange);
                    });
                })
                // Ensure we don't show empty historical rows if the worker 
                // stayed in the same month but different group
                ->orderBy('shift_schedule_worker.start_date', 'desc')
                ->orderBy('nombres');
        }]);

        $globalStartDateStr = ShiftSchedule::where('user_id', auth()->id())->min('start_date');
        $globalStartDate = $globalStartDateStr ? Carbon::parse($globalStartDateStr) : now();

        $maxDate = now()->addMonths(3);

        $monthsData = [
            ['year' => $date->year, 'month' => $date->month, 'daysInMonth' => $date->daysInMonth],
            ['year' => $date2->year, 'month' => $date2->month, 'daysInMonth' => $date2->daysInMonth],
            ['year' => $date3->year, 'month' => $date3->month, 'daysInMonth' => $date3->daysInMonth],
        ];

        return Inertia::render('Shifts/Index', [
            'year' => (int)$year,
            'month' => (int)$month,
            'monthsData' => $monthsData,
            'schedules' => $schedules,
            'shiftDays' => $shiftDays,
            'minYear' => $globalStartDate->year,
            'minMonth' => $globalStartDate->month,
            'maxYear' => $maxDate->year,
            'maxMonth' => $maxDate->month,
        ]);
    }

    public function storeSchedule(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:7',
            'work_days' => 'required|integer|min:1',
            'rest_days' => 'required|integer|min:0',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $schedule = ShiftSchedule::create([
            'user_id' => auth()->id(),
            'name' => $request->name,
            'color' => $request->color,
            'work_days' => $request->work_days,
            'rest_days' => $request->rest_days,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'year' => $request->year ?? now()->year,
            'month' => $request->month ?? now()->month,
            'sort_order' => ShiftSchedule::where('user_id', auth()->id())->count(),
        ]);

        // Note: the generation of the work/rest pattern happens when a worker is assigned
        // in ShiftGroupController, since ShiftDays require a worker_id.

        return redirect()->route('shifts.index', [
            'year' => $request->year,
            'month' => $request->month,
        ]);
    }

    public function updateSchedule(Request $request, ShiftSchedule $schedule)
    {
        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:7',
            'work_days' => 'required|integer|min:1',
            'rest_days' => 'required|integer|min:0',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $schedule->update([
            'name' => $request->name,
            'color' => $request->color,
            'work_days' => $request->work_days,
            'rest_days' => $request->rest_days,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
        ]);

        return redirect()->back();
    }

    public function destroySchedule(Request $request, ShiftSchedule $schedule)
    {
        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        $schedule->delete();
        return redirect()->back();
    }

    public function updateDays(Request $request)
    {
        $request->validate([
            'days' => 'required|array',
            'days.*.shift_schedule_id' => 'required|exists:shift_schedules,id',
            'days.*.worker_id' => 'required|exists:workers,id',
            'days.*.date' => 'required|date',
            'days.*.type' => 'required|string',
            'days.*.note' => 'nullable|string',
        ]);

        \Log::info('Saving shift days payload:', $request->all());

        DB::transaction(function () use ($request) {
            foreach ($request->days as $dayData) {
                // Save all types including 'clear' so we can override base patterns
                ShiftDay::updateOrCreate(
                    [
                        'shift_schedule_id' => $dayData['shift_schedule_id'],
                        'worker_id' => $dayData['worker_id'],
                        'date' => $dayData['date'],
                    ],
                    [
                        'type' => $dayData['type'],
                        'note' => $dayData['note'] ?? null,
                    ]
                );
            }
        });

        return redirect()->back();
    }
    public function reorderSchedules(Request $request)
    {
        $request->validate([
            'ordered_ids' => 'required|array',
            'ordered_ids.*' => 'exists:shift_schedules,id',
        ]);

        foreach ($request->ordered_ids as $index => $id) {
            ShiftSchedule::where('id', $id)
                ->where('user_id', auth()->id())
                ->update(['sort_order' => $index]);
        }

        return redirect()->back();
    }
}
