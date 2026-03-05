<?php

namespace App\Http\Controllers;

use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Validation\Rule;

class WorkerController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            new Middleware('can:viewAny,App\Models\Worker', only: ['index', 'masterList']),
            new Middleware('can:create,App\Models\Worker', only: ['store']),
            new Middleware('can:update,worker', only: ['update']),
            new Middleware('can:delete,worker', only: ['destroy']),
        ];
    }

    public function masterList(Request $request)
    {
        $search = $request->input('search');

        $workers = Worker::select([
            'id', 'nombres', 'apellido_paterno', 'apellido_materno',
            'rut', 'pasaporte', 'nacionalidad',
            'email', 'phone', 'position', 'department', 'is_active'
        ])
        ->when($search, function($query, $search) {
            $terms = explode(' ', $search);
            foreach ($terms as $term) {
                if (trim($term) === '') continue;
                $query->where(function($q) use ($term) {
                    $q->where('nombres', 'ilike', "%{$term}%")
                      ->orWhere('apellido_paterno', 'ilike', "%{$term}%")
                      ->orWhere('apellido_materno', 'ilike', "%{$term}%")
                      ->orWhere('rut', 'ilike', "%{$term}%")
                      ->orWhere('pasaporte', 'ilike', "%{$term}%")
                      ->orWhere('email', 'ilike', "%{$term}%")
                      ->orWhere('position', 'ilike', "%{$term}%")
                      ->orWhere('department', 'ilike', "%{$term}%");
                });
            }
        })
        ->orderBy('apellido_paterno')
        ->paginate(15)
        ->withQueryString();

        return inertia('Workers/MasterList', [
            'workers' => $workers,
            'filters' => $request->only(['search'])
        ]);
    }

    public function index(Request $request)
    {
        // Solo columnas necesarias para el listado: evita traer datos bancarios cifrados
        $workersQuery = Worker::select([
                'id', 'nombres', 'apellido_paterno', 'apellido_materno',
                'rut', 'pasaporte', 'nacionalidad', 'documento_identidad',
                'fecha_nacimiento', 'estado_civil',
                'direccion', 'comuna', 'email', 'phone', 'whatsapp',
                'emergencia_contacto_nombre', 'emergencia_contacto_numero',
                'cta_bancaria', 'cod_banco', 'tipo_cuenta',
                'beneficiario_direccion', 'beneficiario_ciudad',
                'beneficiario_cta_abono', 'beneficiario_swift',
                'position', 'department', 'is_active', 'created_at',
            ]);

        $workers = $workersQuery->orderBy('apellido_paterno')
            ->orderBy('nombres')
            ->paginate(50);

        // Si se solicita editar un trabajador específico (por ID en la URL de MasterList)
        $selectedWorker = null;
        if ($request->has('id')) {
            $selectedWorker = Worker::find($request->id);
        }

        return inertia('Workers/Index', [
            'workers' => $workers,
            'selectedWorker' => $selectedWorker
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nacionalidad'               => 'required|string|max:100',
            'rut'                        => [
                'required_if:nacionalidad,Chilena',
                'nullable',
                'string',
                Rule::unique('workers', 'rut'),
            ],
            'pasaporte'                  => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad'        => 'nullable|string|max:100',
            'nombres'                    => 'required|string|max:255',
            'apellido_paterno'           => 'required|string|max:100',
            'apellido_materno'           => 'required|string|max:100',
            'fecha_nacimiento'           => 'required|date',
            'estado_civil'               => 'required|string|max:50',
            'direccion'                  => 'required|string|max:255',
            'comuna'                     => 'required|string|max:100',
            'email'                      => 'required|email|max:255',
            'phone'                      => 'required|string|max:20',
            'whatsapp'                   => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria'               => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco'                  => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta'                => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad'        => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift'         => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position'                   => 'nullable|string|max:255',
            'department'                 => 'nullable|string|max:255',
            'is_active'                  => 'nullable|boolean',
        ]);

        $validated['name'] = trim(
            ($validated['nombres'] ?? '') . ' ' .
            ($validated['apellido_paterno'] ?? '') . ' ' .
            ($validated['apellido_materno'] ?? '')
        );

        Worker::create($validated);

        return back()->with('success', 'Personal registrado correctamente.');
    }

    public function update(Request $request, Worker $worker)
    {
        $validated = $request->validate([
            'nacionalidad'               => 'required|string|max:100',
            'rut'                        => [
                'required_if:nacionalidad,Chilena',
                'nullable',
                'string',
                Rule::unique('workers', 'rut')->ignore($worker->id),
            ],
            'pasaporte'                  => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad'        => 'nullable|string|max:100',
            'nombres'                    => 'required|string|max:255',
            'apellido_paterno'           => 'required|string|max:100',
            'apellido_materno'           => 'required|string|max:100',
            'fecha_nacimiento'           => 'required|date',
            'estado_civil'               => 'required|string|max:50',
            'direccion'                  => 'required|string|max:255',
            'comuna'                     => 'required|string|max:100',
            'email'                      => 'required|email|max:255',
            'phone'                      => 'required|string|max:20',
            'whatsapp'                   => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria'               => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco'                  => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta'                => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad'        => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono'     => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift'         => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position'                   => 'nullable|string|max:255',
            'department'                 => 'nullable|string|max:255',
            'is_active'                  => 'nullable|boolean',
        ]);

        $validated['name'] = trim(
            ($validated['nombres'] ?? '') . ' ' .
            ($validated['apellido_paterno'] ?? '') . ' ' .
            ($validated['apellido_materno'] ?? '')
        );

        $worker->update($validated);

        return back()->with('success', 'Datos actualizados correctamente.');
    }

    public function destroy(Worker $worker)
    {
        $worker->delete(); // SoftDelete
        return back();
    }

    public function phoneDirectory()
    {
        $workers = Worker::orderBy('nombres')->get();
        return inertia('Workers/PhoneDirectory', [
            'workers' => $workers
        ]);
    }

    public function import()
    {
        return inertia('Workers/Import');
    }

    public function bulkStore(Request $request)
    {
        $request->validate([
            'workers' => 'required|array',
            'workers.*.nombres' => 'required|string',
            'workers.*.apellido_paterno' => 'required|string',
            'workers.*.apellido_materno' => 'nullable|string',
            'workers.*.rut' => 'nullable|string',
            'workers.*.pasaporte' => 'nullable|string',
            'workers.*.nacionalidad' => 'nullable|string',
            'workers.*.email' => 'nullable|string', // Change to string/nullable to be less restrictive during mass import
        ]);

        $created = 0;
        $updated = 0;

        foreach ($request->workers as $workerData) {
            // Find existing worker by RUT or Passport
            $worker = null;
            if (!empty($workerData['rut'])) {
                $worker = Worker::where('rut', $workerData['rut'])->first();
            } elseif (!empty($workerData['pasaporte'])) {
                $worker = Worker::where('pasaporte', $workerData['pasaporte'])->first();
            }

            // Generate full name
            $workerData['name'] = trim(
                ($workerData['nombres'] ?? '') . ' ' .
                ($workerData['apellido_paterno'] ?? '') . ' ' .
                ($workerData['apellido_materno'] ?? '')
            );
            
            // Ensure boolean conversion if needed
            $workerData['is_active'] = filter_var($workerData['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);
            
            if ($worker) {
                $worker->update($workerData);
                $updated++;
            } else {
                Worker::create($workerData);
                $created++;
            }
        }

        return redirect()->route('workers.index')->with('success', "Importación masiva completada: {$created} nuevos creados y {$updated} actualizados.");
    }
}
