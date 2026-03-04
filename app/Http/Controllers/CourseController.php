<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Worker;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Course::class, 'course');
    }

    public function index()
    {
        return inertia('Courses/Index', [
            'courses' => Course::select('id', 'worker_id', 'nombre_curso', 'fecha_realizacion')
                               ->with('worker:id,nombres,apellidos')
                               ->orderBy('fecha_realizacion', 'desc')
                               ->paginate(50),
            'workers' => Worker::select('id', 'nombres', 'apellidos')
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
