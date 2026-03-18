<?php

use App\Http\Controllers\AdminAiStatusController;
use App\Http\Controllers\DocumentCategoryController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\NotebookLMStatusController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProjectController;
use App\Models\Project;
use App\Services\GroqChatService;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

if (app()->environment('local')) {
    Route::get('/test-groq', function (GroqChatService $groq) {
        try {
            $payload = $groq->simplePrompt('Please briefly explain the importance of fast AI inference.');
            $text = $groq->extractAssistantText($payload);

            return response($text !== '' ? $text : 'Groq respondió sin contenido.');
        } catch (\Throwable $e) {
            Log::error('Test Groq falló', [
                'message' => $e->getMessage(),
            ]);

            abort(500, 'Error probando Groq: '.$e->getMessage());
        }
    })->name('test-groq');

    Route::get('/test-gemini', function () {
        $keys = array_values(array_filter(config('services.gemini.keys', [])));
        $models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

        if (empty($keys)) {
            abort(500, 'No hay claves Gemini configuradas en GEMINI_API_KEYS.');
        }

        $lastError = 'No se obtuvo respuesta de Gemini.';

        foreach ($keys as $index => $key) {
            foreach ($models as $model) {
                try {
                    $response = Http::timeout(30)->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}",
                        [
                            'contents' => [[
                                'parts' => [[
                                    'text' => 'Hola, estoy configurando tu API en Laravel, ¿me recibes?',
                                ]],
                            ]],
                            'generationConfig' => [
                                'temperature' => 0.1,
                            ],
                        ]
                    );

                    if ($response->successful()) {
                        $text = trim((string) $response->json('candidates.0.content.parts.0.text'));

                        return response($text !== '' ? $text : 'Gemini respondió sin contenido.');
                    }

                    $lastError = $response->json('error.message')
                        ?? $response->body();

                    Log::warning("Test Gemini falló con key #{$index} y modelo {$model}", [
                        'status' => $response->status(),
                        'error' => $lastError,
                    ]);
                } catch (\Throwable $e) {
                    $lastError = $e->getMessage();

                    Log::warning("Test Gemini lanzó excepción con key #{$index} y modelo {$model}", [
                        'error' => $lastError,
                    ]);
                }
            }
        }

        abort(500, "Todas las API keys de Gemini fallaron. Último error: {$lastError}");
    })->name('test-gemini');
}

Route::get('/dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::middleware('auth')->group(function () {

    // Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Projects (Faenas)
    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');

    // Categories scoped to project
    Route::get('/projects/{project}/categories', [DocumentCategoryController::class, 'index'])->name('categories.index');
    Route::post('/projects/{project}/categories', [DocumentCategoryController::class, 'store'])->name('categories.store');
    Route::patch('/categories/{category}', [DocumentCategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categories/{category}', [DocumentCategoryController::class, 'destroy'])->name('categories.destroy');

    // Carga masiva de PDFs — crea carpeta Drive por trabajador
    Route::post('/projects/{project}/categories/{category}/bulk-upload', [\App\Http\Controllers\DocumentBulkUploadController::class, 'upload'])
        ->middleware('throttle:30,1')
        ->name('categories.bulk-upload');

    // Documents scoped to category
    Route::post('/categories/{category}/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::delete('/categories/{category}/documents', [DocumentController::class, 'bulkDestroy'])->name('documents.bulk-destroy');
    Route::get('/documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');

    // Health PDF analysis — Rate limited: 10 análisis por minuto por usuario
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/documents/{document}/analyze', [\App\Http\Controllers\DocumentAnalysisController::class, 'analyze'])->name('documents.analyze');
        Route::post('/document-categories/{category}/bulk-analyze', [\App\Http\Controllers\DocumentAnalysisController::class, 'bulkAnalyze'])->name('documents.bulk-analyze');
    });

    Route::get('/notebooklm/status', [NotebookLMStatusController::class, 'show'])->name('notebooklm.status');
    Route::post('/notebooklm/session/import', [NotebookLMStatusController::class, 'import'])->name('notebooklm.import');
    Route::post('/notebooklm/session/renew', [NotebookLMStatusController::class, 'renew'])->name('notebooklm.renew');
    Route::get('/admin/ai-status', [AdminAiStatusController::class, 'index'])->name('admin.ai-status.index');
    Route::get('/admin/ai-status/refresh', [AdminAiStatusController::class, 'refresh'])->name('admin.ai-status.refresh');
    Route::post('/admin/ai-status/routes/update', [AdminAiStatusController::class, 'updateRoute'])->name('admin.ai-status.routes.update');

    // Personnel (Personal)
    Route::get('/workers/checklist', [\App\Http\Controllers\WorkerController::class, 'checklist'])->name('workers.checklist');
    Route::get('/workers/master-list', [\App\Http\Controllers\WorkerController::class, 'masterList'])->name('workers.master-list');
    Route::get('/workers/phone-directory', [\App\Http\Controllers\WorkerController::class, 'phoneDirectory'])->name('workers.phone-directory');
    Route::get('/workers/import', [\App\Http\Controllers\WorkerController::class, 'import'])->name('workers.import');
    Route::post('/workers/bulk', [\App\Http\Controllers\WorkerController::class, 'bulkStore'])->name('workers.bulk-store');
    Route::resource('workers', \App\Http\Controllers\WorkerController::class)->names('workers')->except(['show']);

    // Courses (Cursos)
    Route::resource('courses', \App\Http\Controllers\CourseController::class)->names('courses');

    // Turnos (Shifts)
    Route::get('/shifts', [\App\Http\Controllers\ShiftScheduleController::class, 'index'])->name('shifts.index');
    Route::post('/shifts/days', [\App\Http\Controllers\ShiftScheduleController::class, 'updateDays'])->name('shifts.days.update');

    // Grupos de Turnos (Shift Groups Manager)
    Route::get('/shifts/groups', [\App\Http\Controllers\ShiftGroupController::class, 'index'])->name('shifts.groups.index');
    Route::post('/shifts/schedules', [\App\Http\Controllers\ShiftScheduleController::class, 'storeSchedule'])->name('shifts.schedules.store');
    Route::put('/shifts/schedules/{schedule}', [\App\Http\Controllers\ShiftScheduleController::class, 'updateSchedule'])->name('shifts.schedules.update');
    Route::delete('/shifts/schedules/{schedule}', [\App\Http\Controllers\ShiftScheduleController::class, 'destroySchedule'])->name('shifts.schedules.destroy');
    Route::post('/shifts/groups/schedules/{schedule}/assign-workers', [\App\Http\Controllers\ShiftGroupController::class, 'assignWorkers'])->name('shifts.groups.assign');
    Route::delete('/shifts/schedules/{schedule}/remove/{worker}', [\App\Http\Controllers\ShiftGroupController::class, 'removeWorker'])->name('shifts.schedules.remove');
    Route::post('/shifts/schedules/reorder', [\App\Http\Controllers\ShiftScheduleController::class, 'reorderSchedules'])->name('shifts.schedules.reorder');
});

require __DIR__.'/auth.php';
