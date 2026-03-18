<?php

namespace Tests\Feature\Authorization;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentAnalysisAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_cannot_analyze_document_from_another_users_project(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Norte',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Preocupacional',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'examen.pdf',
            'file_path' => 'fake/path.pdf',
        ]);

        $response = $this
            ->actingAs($intruder)
            ->post(route('documents.analyze', $document));

        $response->assertForbidden();

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'analysis_status' => 'pending',
        ]);
    }
}
