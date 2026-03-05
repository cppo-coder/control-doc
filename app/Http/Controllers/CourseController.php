<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;

class CourseController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            new Middleware('can:viewAny,App\Models\Course', only: ['index']),
            new Middleware('can:create,App\Models\Course', only: ['store']),
            new Middleware('can:update,course', only: ['update']),
            new Middleware('can:delete,course', only: ['destroy']),
        ];
    }

    public function index()
    {
        return inertia('Courses/Index', [
            'courses' => Course::select('id', 'worker_id', 'nombre_curso', 'fecha_realizacion')
                               ->with('worker:id,nombres,apellido_paterno')
                               ->orderBy('fecha_realizacion', 'desc')
                               ->paginate(50),
            'workers' => Worker::select('id', 'nombres', 'apellido_paterno')
                               ->orderBy('nombres')
                               ->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'worker_id'         => 'nullable|exists:workers,id',
            'nombre_curso'      => 'required|string|max:255',
            'fecha_realizacion' => 'required|date',
        ]);

        Course::create($validated);

        return back()->with('success', 'Curso registrado correctamente.');
    }

    public function update(Request $request, Course $course)
    {
        $validated = $request->validate([
            'worker_id'         => 'nullable|exists:workers,id',
            'nombre_curso'      => 'required|string|max:255',
            'fecha_realizacion' => 'required|date',
        ]);

        $course->update($validated);

        return back()->with('success', 'Curso actualizado correctamente.');
    }

    public function destroy(Course $course)
    {
        $course->delete();
        return back()->with('success', 'Curso eliminado.');
    }
}
