<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkerController extends Controller implements HasMiddleware
{
    private const DEFAULT_WORKERS_PER_PAGE = 10;

    private const WORKER_LIST_FIELDS = [
        'id', 'nombres', 'apellido_paterno', 'apellido_materno',
        'rut', 'pasaporte', 'nacionalidad', 'documento_identidad',
        'fecha_nacimiento', 'estado_civil',
        'direccion', 'comuna', 'email', 'phone', 'whatsapp',
        'emergencia_contacto_nombre', 'emergencia_contacto_numero',
        'position', 'department', 'is_active',
        'licencia_conduccion', 'licencia_conduccion_vencimiento',
        'tipo_contrato', 'contrato_inicio', 'contrato_termino',
        'created_at',
    ];

    private const WORKER_EDIT_FIELDS = [
        'id', 'rut', 'nacionalidad', 'pasaporte', 'documento_identidad',
        'nombres', 'apellido_paterno', 'apellido_materno', 'sexo',
        'fecha_nacimiento', 'estado_civil', 'direccion', 'comuna',
        'email', 'phone', 'whatsapp',
        'emergencia_contacto_numero', 'emergencia_contacto_nombre',
        'cta_bancaria', 'cod_banco', 'tipo_cuenta',
        'beneficiario_direccion', 'beneficiario_ciudad',
        'beneficiario_cta_abono', 'beneficiario_swift',
        'position', 'department', 'is_active',
        'licencia_conduccion', 'licencia_conduccion_vencimiento',
        'tipo_contrato', 'contrato_inicio', 'contrato_termino',
    ];

    private const PHONE_DIRECTORY_FIELDS = [
        'id', 'nombres', 'apellido_paterno', 'apellido_materno',
        'rut', 'pasaporte', 'nacionalidad',
        'phone', 'whatsapp',
        'emergencia_contacto_nombre', 'emergencia_contacto_numero',
    ];

    private const BULK_IMPORT_FIELDS = [
        'nacionalidad', 'rut', 'pasaporte', 'documento_identidad',
        'nombres', 'apellido_paterno', 'apellido_materno',
        'fecha_nacimiento', 'estado_civil', 'comuna', 'direccion',
        'email', 'phone', 'whatsapp',
        'emergencia_contacto_nombre', 'emergencia_contacto_numero',
        'cod_banco', 'tipo_cuenta', 'cta_bancaria',
        'beneficiario_direccion', 'beneficiario_ciudad',
        'beneficiario_cta_abono', 'beneficiario_swift',
        'position', 'department', 'is_active',
    ];

    public static function middleware(): array
    {
        return [
            new Middleware('can:viewAny,App\Models\Worker', only: ['index', 'masterList', 'phoneDirectory', 'checklist']),
            new Middleware('can:create,App\Models\Worker', only: ['store', 'import', 'bulkStore']),
            new Middleware('can:update,worker', only: ['update']),
            new Middleware('can:delete,worker', only: ['destroy']),
        ];
    }

    public function masterList(Request $request)
    {
        $search = $request->input('search');

        $workers = Worker::select([
            'id', 'nombres', 'apellido_paterno', 'apellido_materno',
            'rut', 'pasaporte', 'nacionalidad', 'sexo',
            'email', 'phone', 'position', 'department', 'is_active',
            'licencia_conduccion_vencimiento',
        ])
            ->when($search, function ($query, $search) {
                $terms = explode(' ', $search);
                foreach ($terms as $term) {
                    if (trim($term) === '') {
                        continue;
                    }
                    $query->where(function ($q) use ($term) {
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
            ->paginate(self::DEFAULT_WORKERS_PER_PAGE)
            ->withQueryString();

        return inertia('Workers/MasterList', [
            'workers' => $workers,
            'filters' => $request->only(['search']),
        ]);
    }

    public function checklist(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $projectId = $request->integer('project_id');

        $projects = Project::query()
            ->where('user_id', $request->user()->id)
            ->with(['categories' => function ($query) {
                $query->select(['id', 'project_id', 'name', 'sort_order'])
                    ->orderBy('sort_order')
                    ->orderBy('name');
            }])
            ->orderBy('name')
            ->get(['id', 'name']);

        $selectedProject = $projects->firstWhere('id', $projectId) ?? $projects->first();

        $checklistCategories = collect($selectedProject?->categories ?? [])
            ->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'document_type' => $this->resolveChecklistDocumentType($category->name),
            ])
            ->values();

        $documentTypes = $checklistCategories
            ->pluck('document_type')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $workers = Worker::query()
            ->select([
                'id', 'nombres', 'apellido_paterno', 'apellido_materno',
                'rut', 'pasaporte', 'position', 'department', 'is_active',
            ])
            ->with(['documents' => function ($query) use ($documentTypes) {
                $query->select([
                    'id',
                    'worker_id',
                    'tipo',
                    'estado',
                    'tiene_documento',
                    'fecha_vencimiento',
                    'archivo_referencia',
                ]);

                if ($documentTypes !== []) {
                    $query->whereIn('tipo', $documentTypes);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }])
            ->when($search !== '', function ($query) use ($search) {
                $terms = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY);

                foreach ($terms as $term) {
                    $query->where(function ($subQuery) use ($term) {
                        $subQuery->where('nombres', 'ilike', "%{$term}%")
                            ->orWhere('apellido_paterno', 'ilike', "%{$term}%")
                            ->orWhere('apellido_materno', 'ilike', "%{$term}%")
                            ->orWhere('rut', 'ilike', "%{$term}%")
                            ->orWhere('pasaporte', 'ilike', "%{$term}%")
                            ->orWhere('position', 'ilike', "%{$term}%")
                            ->orWhere('department', 'ilike', "%{$term}%");
                    });
                }
            })
            ->orderBy('apellido_paterno')
            ->orderBy('nombres')
            ->paginate(self::DEFAULT_WORKERS_PER_PAGE)
            ->withQueryString();

        return inertia('Workers/Checklist', [
            'workers' => $workers,
            'projects' => $projects->map(fn ($project) => [
                'id' => $project->id,
                'name' => $project->name,
                'categories_count' => $project->categories->count(),
            ])->values(),
            'selectedProject' => $selectedProject
                ? [
                    'id' => $selectedProject->id,
                    'name' => $selectedProject->name,
                ]
                : null,
            'checklistCategories' => $checklistCategories,
            'filters' => [
                'search' => $search,
                'project_id' => $selectedProject?->id,
            ],
        ]);
    }

    private function resolveChecklistDocumentType(?string $categoryName): ?string
    {
        $normalized = str((string) $categoryName)
            ->lower()
            ->ascii()
            ->value();

        if (str_contains($normalized, 'contrato') || str_contains($normalized, 'anexo')) {
            return 'contrato';
        }

        if (str_contains($normalized, 'altura') || str_contains($normalized, 'altitud')) {
            return 'examen_altura';
        }

        if (str_contains($normalized, 'psico')) {
            return 'psicosensotecnico';
        }

        return str((string) $categoryName)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value() ?: null;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $canManageWorkers = $user?->hasAnyRole(['admin', 'supervisor']) ?? false;

        // Solo columnas necesarias para el listado: evita exponer datos bancarios al frontend
        $workersQuery = Worker::select(self::WORKER_LIST_FIELDS);

        $workers = $workersQuery->orderBy('apellido_paterno')
            ->orderBy('nombres')
            ->paginate(50);

        // Si se solicita editar un trabajador específico (por ID en la URL de MasterList)
        $selectedWorker = null;
        if ($canManageWorkers && $request->has('id')) {
            $selectedWorker = Worker::select(self::WORKER_EDIT_FIELDS)->find($request->id);
        }

        return inertia('Workers/Index', [
            'workers' => $workers,
            'selectedWorker' => $selectedWorker,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nacionalidad' => 'required|string|max:100',
            'rut' => [
                'required_if:nacionalidad,Chilena',
                'nullable',
                'string',
                Rule::unique('workers', 'rut'),
            ],
            'pasaporte' => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad' => 'nullable|string|max:100',
            'nombres' => 'required|string|max:255',
            'apellido_paterno' => 'required|string|max:100',
            'apellido_materno' => 'required|string|max:100',
            'sexo' => 'required|string|max:20',
            'fecha_nacimiento' => 'required|date',
            'estado_civil' => 'required|string|max:50',
            'direccion' => 'required|string|max:255',
            'comuna' => 'required|string|max:100',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:20',
            'whatsapp' => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria' => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco' => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta' => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion' => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad' => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'licencia_conduccion' => 'nullable|boolean',
            'licencia_conduccion_vencimiento' => 'nullable|date',
            'tipo_contrato' => 'nullable|string|max:100',
            'contrato_inicio' => 'nullable|date',
            'contrato_termino' => 'nullable|date',
        ]);

        $validated['name'] = trim(
            ($validated['nombres'] ?? '').' '.
            ($validated['apellido_paterno'] ?? '').' '.
            ($validated['apellido_materno'] ?? '')
        );

        Worker::create($validated);

        $this->forgetWorkerCaches();

        return back()->with('success', 'Personal registrado correctamente.');
    }

    public function update(Request $request, Worker $worker)
    {
        $validated = $request->validate([
            'nacionalidad' => 'required|string|max:100',
            'rut' => [
                'required_if:nacionalidad,Chilena',
                'nullable',
                'string',
                Rule::unique('workers', 'rut')->ignore($worker->id),
            ],
            'pasaporte' => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'documento_identidad' => 'nullable|string|max:100',
            'nombres' => 'required|string|max:255',
            'apellido_paterno' => 'required|string|max:100',
            'apellido_materno' => 'required|string|max:100',
            'sexo' => 'required|string|max:20',
            'fecha_nacimiento' => 'required|date',
            'estado_civil' => 'required|string|max:50',
            'direccion' => 'required|string|max:255',
            'comuna' => 'required|string|max:100',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:20',
            'whatsapp' => 'required|string|max:20',
            'emergencia_contacto_numero' => 'required|string|max:20',
            'emergencia_contacto_nombre' => 'required|string|max:255',
            'cta_bancaria' => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'cod_banco' => 'required_if:nacionalidad,Chilena|nullable|string|max:20',
            'tipo_cuenta' => 'required_if:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_direccion' => 'required_unless:nacionalidad,Chilena|nullable|string|max:255',
            'beneficiario_ciudad' => 'required_unless:nacionalidad,Chilena|nullable|string|max:100',
            'beneficiario_cta_abono' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'beneficiario_swift' => 'required_unless:nacionalidad,Chilena|nullable|string|max:50',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'licencia_conduccion' => 'nullable|boolean',
            'licencia_conduccion_vencimiento' => 'nullable|date',
            'tipo_contrato' => 'nullable|string|max:100',
            'contrato_inicio' => 'nullable|date',
            'contrato_termino' => 'nullable|date',
        ]);

        $validated['name'] = trim(
            ($validated['nombres'] ?? '').' '.
            ($validated['apellido_paterno'] ?? '').' '.
            ($validated['apellido_materno'] ?? '')
        );

        $worker->update($validated);

        $this->forgetWorkerCaches();

        return back()->with('success', 'Datos actualizados correctamente.');
    }

    public function destroy(Worker $worker)
    {
        $worker->delete(); // SoftDelete
        $this->forgetWorkerCaches();

        return back();
    }

    public function phoneDirectory(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $directoryVersion = Cache::get('workers.phone-directory.version', 1);
        $cacheKey = 'workers.phone-directory.'.$directoryVersion.'.'.md5($search.'|page:'.$request->integer('page', 1));

        $workers = Cache::remember(
            $cacheKey,
            now()->addMinutes(5),
            function () use ($search) {
                return Worker::select(self::PHONE_DIRECTORY_FIELDS)
                    ->when($search !== '', function ($query) use ($search) {
                        $terms = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY);

                        foreach ($terms as $term) {
                            $query->where(function ($subQuery) use ($term) {
                                $subQuery->where('nombres', 'like', "%{$term}%")
                                    ->orWhere('apellido_paterno', 'like', "%{$term}%")
                                    ->orWhere('apellido_materno', 'like', "%{$term}%")
                                    ->orWhere('rut', 'like', "%{$term}%")
                                    ->orWhere('pasaporte', 'like', "%{$term}%")
                                    ->orWhere('phone', 'like', "%{$term}%")
                                    ->orWhere('whatsapp', 'like', "%{$term}%")
                                    ->orWhere('emergencia_contacto_nombre', 'like', "%{$term}%")
                                    ->orWhere('emergencia_contacto_numero', 'like', "%{$term}%");
                            });
                        }
                    })
                    ->orderBy('nombres')
                    ->paginate(25)
                    ->withQueryString();
            }
        );

        return inertia('Workers/PhoneDirectory', [
            'workers' => $workers,
            'filters' => $request->only('search'),
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
            'workers.*.nombres' => 'required|string|max:255',
            'workers.*.apellido_paterno' => 'required|string|max:100',
            'workers.*.apellido_materno' => 'nullable|string|max:100',
            'workers.*.rut' => 'nullable|string|max:50',
            'workers.*.pasaporte' => 'nullable|string|max:100',
            'workers.*.nacionalidad' => 'nullable|string|max:100',
            'workers.*.documento_identidad' => 'nullable|string|max:100',
            'workers.*.fecha_nacimiento' => 'nullable|date',
            'workers.*.estado_civil' => 'nullable|string|max:50',
            'workers.*.comuna' => 'nullable|string|max:100',
            'workers.*.direccion' => 'nullable|string|max:255',
            'workers.*.email' => 'nullable|email|max:255',
            'workers.*.phone' => 'nullable|string|max:20',
            'workers.*.whatsapp' => 'nullable|string|max:20',
            'workers.*.emergencia_contacto_nombre' => 'nullable|string|max:255',
            'workers.*.emergencia_contacto_numero' => 'nullable|string|max:20',
            'workers.*.cod_banco' => 'nullable|string|max:20',
            'workers.*.tipo_cuenta' => 'nullable|string|max:50',
            'workers.*.cta_bancaria' => 'nullable|string|max:50',
            'workers.*.beneficiario_direccion' => 'nullable|string|max:255',
            'workers.*.beneficiario_ciudad' => 'nullable|string|max:100',
            'workers.*.beneficiario_cta_abono' => 'nullable|string|max:50',
            'workers.*.beneficiario_swift' => 'nullable|string|max:50',
            'workers.*.position' => 'nullable|string|max:255',
            'workers.*.department' => 'nullable|string|max:255',
            'workers.*.is_active' => 'nullable|boolean',
        ]);

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($request, &$created, &$updated) {
            foreach ($request->workers as $workerData) {
                $worker = null;
                if (! empty($workerData['rut'])) {
                    $worker = Worker::where('rut', $workerData['rut'])->first();
                } elseif (! empty($workerData['pasaporte'])) {
                    $worker = Worker::where('pasaporte', $workerData['pasaporte'])->first();
                }

                $payload = Arr::only($workerData, self::BULK_IMPORT_FIELDS);
                $payload['name'] = trim(
                    ($payload['nombres'] ?? '').' '.
                    ($payload['apellido_paterno'] ?? '').' '.
                    ($payload['apellido_materno'] ?? '')
                );
                $payload['is_active'] = filter_var($payload['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

                if ($worker) {
                    $this->authorize('update', $worker);
                    $worker->update($payload);
                    $updated++;
                } else {
                    $this->authorize('create', Worker::class);
                    Worker::create($payload);
                    $created++;
                }
            }
        });

        $this->forgetWorkerCaches();

        return redirect()->route('workers.index')->with('success', "Importación masiva completada: {$created} nuevos creados y {$updated} actualizados.");
    }

    private function forgetWorkerCaches(): void
    {
        Cache::increment('workers.phone-directory.version');
        Cache::forget('courses.worker-options');
    }
}
