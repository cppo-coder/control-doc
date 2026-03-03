<?php

namespace App\Http\Controllers;

use App\Models\Worker;
use Illuminate\Http\Request;

class WorkerController extends Controller
{
    public function index()
    {
        return inertia('Workers/Index', [
            'workers' => Worker::orderBy('nombres')->orderBy('apellido_paterno')->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nacionalidad'         => 'required|string|max:100',
            'rut'                  => 'required_if:nacionalidad,Chilena|nullable|string|unique:workers,rut',
            'pasaporte'            => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad'  => 'nullable|string|max:100',
            'nombres'              => 'required|string|max:255',
            'apellido_paterno'     => 'required|string|max:100',
            'apellido_materno'     => 'required|string|max:100',
            'fecha_nacimiento'     => 'required|date',
            'estado_civil'         => 'required|string|max:50',
            'direccion'            => 'required|string|max:255',
            'comuna'               => 'required|string|max:100',
            'email'                => 'required|email|max:255',
            'phone'                => 'required|string|max:20',
            'whatsapp'             => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria'         => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco'            => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta'          => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion' => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad'    => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position'             => 'nullable|string|max:255',
            'department'           => 'nullable|string|max:255',
        ]);

        // Helper: Combine full name for compatibility
        $validated['name'] = trim(($validated['nombres'] ?? '') . ' ' . ($validated['apellido_paterno'] ?? '') . ' ' . ($validated['apellido_materno'] ?? ''));

        Worker::create($validated);

        return back()->with('success', 'Personal registrado correctamente.');
    }

    public function update(Request $request, Worker $worker)
    {
        $validated = $request->validate([
            'nacionalidad'         => 'required|string|max:100',
            'rut'                  => 'required_if:nacionalidad,Chilena|nullable|string|unique:workers,rut,' . $worker->id,
            'pasaporte'            => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad'  => 'nullable|string|max:100',
            'nombres'              => 'required|string|max:255',
            'apellido_paterno'     => 'required|string|max:100',
            'apellido_materno'     => 'required|string|max:100',
            'fecha_nacimiento'     => 'required|date',
            'estado_civil'         => 'required|string|max:50',
            'direccion'            => 'required|string|max:255',
            'comuna'               => 'required|string|max:100',
            'email'                => 'required|email|max:255',
            'phone'                => 'required|string|max:20',
            'whatsapp'             => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria'         => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco'            => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta'          => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion' => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad'    => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position'             => 'nullable|string|max:255',
            'department'           => 'nullable|string|max:255',
        ]);

        $validated['name'] = trim(($validated['nombres'] ?? '') . ' ' . ($validated['apellido_paterno'] ?? '') . ' ' . ($validated['apellido_materno'] ?? ''));

        $worker->update($validated);

        return back()->with('success', 'Datos actualizados correctamente.');
    }

    public function destroy(Worker $worker)
    {
        $worker->delete();
        return back();
    }
}
