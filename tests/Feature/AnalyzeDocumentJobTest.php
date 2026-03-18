<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeDocumentJob;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use App\Services\NotebookLMPipelineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class AnalyzeDocumentJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_prepare_job_automatically_enqueues_analyze_for_pipeline_documents(): void
    {
        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Pipeline',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'examen.pdf',
            'file_path' => 'notebooklm-staging/Faena Pipeline/Examen Altura/examen.pdf',
            'analysis_status' => 'pending',
            'analysis_data' => [],
        ]);

        $service = Mockery::mock(NotebookLMPipelineService::class);
        $service->shouldReceive('prepare')
            ->once()
            ->withArgs(fn (Document $incoming) => $incoming->is($document))
            ->andReturn(['success' => true]);
        $service->shouldReceive('isPipelineCategory')
            ->once()
            ->withArgs(fn ($incomingCategory) => $incomingCategory instanceof DocumentCategory && $incomingCategory->is($category))
            ->andReturn(true);
        $service->shouldReceive('enqueue')
            ->once()
            ->withArgs(fn (Document $incoming, string $mode) => $incoming->id === $document->id && $mode === 'analyze');

        $job = new AnalyzeDocumentJob($document, 'prepare');
        $job->handle($service);
    }
}
