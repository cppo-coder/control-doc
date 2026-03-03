<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\DocumentCategoryController;
use App\Http\Controllers\DocumentController;
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

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

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

    // Health PDF analysis
    Route::post('/documents/{document}/analyze', [\App\Http\Controllers\DocumentAnalysisController::class, 'analyze'])->name('documents.analyze');

    // Personnel (Personal)
    Route::resource('workers', \App\Http\Controllers\WorkerController::class)->names('workers');
});

require __DIR__ . '/auth.php';
