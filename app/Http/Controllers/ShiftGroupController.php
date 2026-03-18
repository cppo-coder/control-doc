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
        $userId = auth()->id();
        $year = $request->query('year', now()->year);
        $month = $request->query('month', now()->month);

        $date = Carbon::createFromDate($year, $month, 1);
        $startOfMonth = $date->copy()->startOfMonth()->format('Y-m-d');
        $endOfMonth = $date->copy()->endOfMonth()->format('Y-m-d');

        // Fetch groups intersecting this month
        $schedules = ShiftSchedule::where('user_id', $userId)
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
        $unassignedWorkers = Worker::select('id', 'nombres', 'apellido_paterno', 'apellido_materno', 'rut', 'position')
            ->whereNotExists(function ($query) use ($userId) {
                $query->selectRaw('1')
                    ->from('shift_schedule_worker')
                    ->join('shift_schedules', 'shift_schedules.id', '=', 'shift_schedule_worker.shift_schedule_id')
                    ->whereColumn('shift_schedule_worker.worker_id', 'workers.id')
                    ->where('shift_schedules.user_id', $userId)
                    ->whereNull('shift_schedule_worker.end_date');
            })
            ->orderBy('nombres')
            ->get();

        $globalStartDateStr = ShiftSchedule::where('user_id', $userId)->min('start_date');
        $globalStartDate = $globalStartDateStr ? Carbon::parse($globalStartDateStr) : now();

        $maxDate = now()->addMonths(3);

        return Inertia::render('Shifts/Groups', [
            'year' => (int) $year,
            'month' => (int) $month,
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
            'start_date' => 'nullable|date',
        ]);

        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        // Si no viene fecha, usamos el primero del mes seleccionado o el inicio del turno
        $year = $request->input('year', now()->year);
        $month = $request->input('month', now()->month);

        $startDate = $request->start_date ?: max(
            date('Y-m-d', strtotime("$year-$month-01")),
            $schedule->start_date
        );

        $yesterdayOfStart = date('Y-m-d', strtotime($startDate.' -1 day'));

        // Finalizar asignaciones activas previas para estos trabajadores
        DB::table('shift_schedule_worker')
            ->join('shift_schedules', 'shift_schedules.id', '=', 'shift_schedule_worker.shift_schedule_id')
            ->whereIn('shift_schedule_worker.worker_id', $request->worker_ids)
            ->where('shift_schedules.user_id', auth()->id())
            ->whereNull('shift_schedule_worker.end_date')
            ->update(['shift_schedule_worker.end_date' => $yesterdayOfStart]);

        $timestamp = now();

        // Crear nuevas asignaciones en bloque para evitar un insert por trabajador.
        DB::table('shift_schedule_worker')->insert(
            collect($request->worker_ids)->map(fn ($workerId) => [
                'shift_schedule_id' => $schedule->id,
                'worker_id' => $workerId,
                'start_date' => $startDate,
                'end_date' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])->all()
        );

        return redirect()->back();
    }

    public function removeWorker(Request $request, ShiftSchedule $schedule, Worker $worker)
    {
        if ($schedule->user_id !== auth()->id()) {
            abort(403);
        }

        if ($request->force_delete) {
            $schedule->workers()->detach($worker->id);
        } else {
            $endDate = $request->input('end_date', now()->format('Y-m-d'));

            DB::table('shift_schedule_worker')
                ->where('shift_schedule_id', $schedule->id)
                ->where('worker_id', $worker->id)
                ->whereNull('end_date')
                ->update(['end_date' => $endDate]);
        }

        return redirect()->back();
    }
}
