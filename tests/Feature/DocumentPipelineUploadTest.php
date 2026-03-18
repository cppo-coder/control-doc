<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeDocumentJob;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use App\Services\DocumentAnalysisService;
use App\Services\NotebookLMAnalysisService;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMBridgeService;
use App\Services\NotebookLMPipelineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentPipelineUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->instance(NotebookLMAuthStatusService::class, new class extends NotebookLMAuthStatusService
        {
            public function status(bool $fresh = false): array
            {
                return [
                    'status' => 'valid',
                    'ok' => true,
                    'message' => 'Sesion NotebookLM valida.',
                    'renewal_required' => false,
                ];
            }
        });
    }

    public function test_exam_upload_is_staged_and_queued_before_drive_storage(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $response = $this
            ->actingAs($owner)
            ->postJson(route('documents.store', $category), [
                'document' => UploadedFile::fake()->create('examen.pdf', 50, 'application/pdf'),
            ]);

        $response
            ->assertOk()
            ->assertJson([
                'success' => true,
                'status' => 'pending',
                'pipeline_status' => 'received',
            ]);

        $this->assertDatabaseHas('documents', [
            'document_category_id' => $category->id,
            'name' => 'examen.pdf',
            'analysis_status' => 'pending',
        ]);

        $this->assertDatabaseHas('notebook_l_m_documents', [
            'sync_status' => 'received',
        ]);

        Queue::assertPushed(AnalyzeDocumentJob::class);
    }

    public function test_non_pipeline_upload_is_persisted_in_drive_and_returns_success_json(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Contratos',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Documentos Generales',
        ]);

        $response = $this
            ->actingAs($owner)
            ->postJson(route('documents.store', $category), [
                'document' => UploadedFile::fake()->createWithContent('respaldo.pdf', 'pdf-content'),
            ]);

        $response
            ->assertOk()
            ->assertJson([
                'success' => true,
                'status' => 'pending',
                'error' => null,
            ]);

        $this->assertDatabaseHas('documents', [
            'document_category_id' => $category->id,
            'name' => 'respaldo.pdf',
            'analysis_status' => 'pending',
        ]);

        $document = $category->documents()->firstOrFail();

        Storage::disk('google')->assertExists($document->file_path);
        Queue::assertNothingPushed();
    }

    public function test_duplicate_file_is_rejected_and_not_uploaded_twice(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $payload = UploadedFile::fake()->createWithContent('examen.pdf', 'same-pdf-content');

        $this->actingAs($owner)
            ->postJson(route('documents.store', $category), [
                'document' => $payload,
            ])
            ->assertOk();

        $duplicatePayload = UploadedFile::fake()->createWithContent('examen-copia.pdf', 'same-pdf-content');

        $this->actingAs($owner)
            ->postJson(route('documents.store', $category), [
                'document' => $duplicatePayload,
            ])
            ->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'error' => 'La informacion de este archivo ya existe en el sistema.',
            ]);

        $this->assertDatabaseCount('documents', 1);
        Queue::assertPushed(AnalyzeDocumentJob::class, 1);
    }

    public function test_bulk_upload_uses_selected_category_instead_of_guessing_exam_folder(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $selectedCategory = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Contratos',
        ]);

        DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $response = $this
            ->actingAs($owner)
            ->postJson(route('categories.bulk-upload', ['project' => $project->id, 'category' => $selectedCategory->id]), [
                'file' => UploadedFile::fake()->create('contrato.pdf', 50, 'application/pdf'),
            ]);

        $response
            ->assertOk()
            ->assertJson([
                'success' => true,
                'category_id' => $selectedCategory->id,
                'category_name' => 'Contratos',
                'pipeline_status' => 'received',
            ]);

        $this->assertDatabaseHas('documents', [
            'document_category_id' => $selectedCategory->id,
            'name' => 'contrato.pdf',
            'analysis_status' => 'pending',
        ]);

        Queue::assertPushed(AnalyzeDocumentJob::class);
    }

    public function test_bulk_upload_duplicate_returns_duplicate_result_instead_of_http_error(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $firstPayload = UploadedFile::fake()->createWithContent('examen.pdf', 'same-pdf-content');

        $this->actingAs($owner)
            ->postJson(route('categories.bulk-upload', ['project' => $project->id, 'category' => $category->id]), [
                'file' => $firstPayload,
            ])
            ->assertOk();

        $duplicatePayload = UploadedFile::fake()->createWithContent('examen-copia.pdf', 'same-pdf-content');

        $this->actingAs($owner)
            ->postJson(route('categories.bulk-upload', ['project' => $project->id, 'category' => $category->id]), [
                'file' => $duplicatePayload,
            ])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'duplicate' => true,
                'status' => 'duplicate',
                'resumen' => 'La informacion de este archivo ya existe en el sistema.',
            ]);

        $this->assertDatabaseCount('documents', 1);
        Queue::assertPushed(AnalyzeDocumentJob::class, 1);
    }

    public function test_invalid_exam_type_is_rejected_before_it_is_persisted_or_queued(): void
    {
        Queue::fake();
        Storage::fake('local');
        Storage::fake('google');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $analysisService = $this->createMock(DocumentAnalysisService::class);
        $analysisService->method('analyzeUploadedPdf')->willReturn([
            'success' => true,
            'status' => 'rejected',
            'data' => [
                'es_examen_salud' => false,
                'trabajador' => 'Caso Rechazado',
                'motivo_rechazo' => 'El archivo no corresponde a la categoria Examen de Altura.',
                'resumen' => 'El archivo no corresponde a la categoria Examen de Altura.',
            ],
        ]);

        $pipelineService = new NotebookLMPipelineService(
            $this->createMock(NotebookLMAnalysisService::class),
            $analysisService,
            $this->createMock(NotebookLMBridgeService::class),
        );

        $this->instance(NotebookLMPipelineService::class, $pipelineService);

        $response = $this
            ->actingAs($owner)
            ->postJson(route('categories.bulk-upload', ['project' => $project->id, 'category' => $category->id]), [
                'file' => UploadedFile::fake()->create('contrato-disfrazado.pdf', 50, 'application/pdf'),
            ]);

        $response
            ->assertOk()
            ->assertJson([
                'success' => false,
                'rejected' => true,
                'status' => 'rejected',
                'resumen' => 'El archivo no corresponde a la categoria Examen de Altura.',
            ]);

        $this->assertDatabaseCount('documents', 0);
        Queue::assertNothingPushed();
    }

    public function test_destroy_category_removes_documents_and_storage(): void
    {
        Storage::fake('google');
        Storage::fake('local');

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Contratos',
        ]);

        Storage::disk('google')->put('Faena Pipeline/Contratos/file-a.pdf', 'pdf-a');
        Storage::disk('google')->put('Faena Pipeline/Contratos/file-b.pdf', 'pdf-b');

        $category->documents()->create([
            'name' => 'file-a.pdf',
            'file_path' => 'Faena Pipeline/Contratos/file-a.pdf',
            'analysis_status' => 'pending',
        ]);

        $category->documents()->create([
            'name' => 'file-b.pdf',
            'file_path' => 'Faena Pipeline/Contratos/file-b.pdf',
            'analysis_status' => 'pending',
        ]);

        $this->actingAs($owner)
            ->delete(route('categories.destroy', $category))
            ->assertRedirect();

        $this->assertDatabaseMissing('document_categories', [
            'id' => $category->id,
        ]);

        $this->assertDatabaseMissing('documents', [
            'document_category_id' => $category->id,
        ]);

        Storage::disk('google')->assertMissing('Faena Pipeline/Contratos/file-a.pdf');
        Storage::disk('google')->assertMissing('Faena Pipeline/Contratos/file-b.pdf');
    }
}
