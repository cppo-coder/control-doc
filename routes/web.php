<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\DocumentCategoryController;
use App\Http\Controllers\DocumentController;
use App\Models\Project;
use App\Models\Worker;
use App\Models\Course;
use App\Models\Document;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin'       => Route::has('login'),
        'canRegister'    => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion'     => PHP_VERSION,
    ]);
});

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

    // Carga masiva de PDFs — crea carpeta Drive por trabajador
    Route::post('/projects/{project}/bulk-upload', [\App\Http\Controllers\DocumentBulkUploadController::class, 'upload'])->name('projects.bulk-upload');

    // Documents scoped to category
    Route::post('/categories/{category}/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');

    // Health PDF analysis — Rate limited: 10 análisis por minuto por usuario
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/documents/{document}/analyze', [\App\Http\Controllers\DocumentAnalysisController::class, 'analyze'])->name('documents.analyze');
        Route::post('/document-categories/{category}/bulk-analyze', [\App\Http\Controllers\DocumentAnalysisController::class, 'bulkAnalyze'])->name('documents.bulk-analyze');
    });

    // Personnel (Personal)
    Route::get('/workers/master-list', [\App\Http\Controllers\WorkerController::class, 'masterList'])->name('workers.master-list');
    Route::get('/workers/phone-directory', [\App\Http\Controllers\WorkerController::class, 'phoneDirectory'])->name('workers.phone-directory');
    Route::get('/workers/import', [\App\Http\Controllers\WorkerController::class, 'import'])->name('workers.import');
    Route::post('/workers/bulk', [\App\Http\Controllers\WorkerController::class, 'bulkStore'])->name('workers.bulk-store');
    Route::resource('workers', \App\Http\Controllers\WorkerController::class)->names('workers');

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

require __DIR__ . '/auth.php';
