<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentCategoriesPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_index_omits_full_analysis_payload_from_document_list(): void
    {
        $owner = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Norte',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Ocupacional',
        ]);

        Document::create([
            'document_category_id' => $category->id,
            'name' => 'salud.pdf',
            'file_path' => 'fake/salud.pdf',
            'analysis_status' => 'alert',
            'analysis_data' => [
                'trabajador' => 'Juan Perez',
                'resumen' => 'Detalle pesado',
                'imc' => ['valor' => 31.2],
            ],
        ]);

        $response = $this->actingAs($owner)->get(route('categories.index', $project));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('DocumentCategories/Index')
            ->where('categories.0.documents.0.name', 'salud.pdf')
            ->where('categories.0.documents.0.has_analysis_details', true)
            ->missing('categories.0.documents.0.analysis_data')
        );
    }

    public function test_document_detail_endpoint_returns_analysis_data_on_demand(): void
    {
        $owner = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Centro',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Preocupacional',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'detalle.pdf',
            'file_path' => 'fake/detalle.pdf',
            'analysis_status' => 'clean',
            'analysis_data' => [
                'trabajador' => 'Maria Soto',
                'resumen' => 'Sin alertas',
            ],
        ]);

        $this->actingAs($owner)
            ->getJson(route('documents.show', $document))
            ->assertOk()
            ->assertJson([
                'id' => $document->id,
                'analysis_status' => 'clean',
                'analysis_data' => [
                    'trabajador' => 'Maria Soto',
                    'resumen' => 'Sin alertas',
                ],
            ]);
    }

    public function test_document_detail_endpoint_forbids_access_to_foreign_documents(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();

        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Faena Sur',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen Altura',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'privado.pdf',
            'file_path' => 'fake/privado.pdf',
            'analysis_status' => 'critical',
            'analysis_data' => ['resumen' => 'Privado'],
        ]);

        $this->actingAs($intruder)
            ->getJson(route('documents.show', $document))
            ->assertForbidden();
    }
}
