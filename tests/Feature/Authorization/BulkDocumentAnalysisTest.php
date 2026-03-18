<?php

namespace Tests\Feature\Authorization;

use App\Jobs\AnalyzeDocumentJob;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class BulkDocumentAnalysisTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_bulk_analyze_documents_in_their_category(): void
    {
        Queue::fake();

        $owner = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Centro',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Ocupacional',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'salud.pdf',
            'file_path' => 'fake/salud.pdf',
        ]);

        $response = $this
            ->actingAs($owner)
            ->postJson(route('documents.bulk-analyze', $category));

        Queue::assertPushed(AnalyzeDocumentJob::class, function (AnalyzeDocumentJob $job) use ($document) {
            return $job->document->is($document);
        });

        $response
            ->assertOk()
            ->assertJson([
                'success' => true,
                'queued' => 1,
                'results' => [[
                    'document_id' => $document->id,
                    'name' => 'salud.pdf',
                    'success' => true,
                    'status' => 'queued',
                ]],
            ]);
    }

    public function test_non_owner_cannot_bulk_analyze_documents_in_foreign_category(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Sur',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Preocupacional',
        ]);

        $response = $this
            ->actingAs($intruder)
            ->postJson(route('documents.bulk-analyze', $category));

        $response->assertForbidden();
    }
}
