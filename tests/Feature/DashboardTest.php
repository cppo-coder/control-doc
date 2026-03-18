<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_shows_only_documents_from_logged_in_users_projects(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();

        $ownerProject = Project::create([
            'user_id' => $owner->id,
            'name' => 'Proyecto Propio',
        ]);

        $otherProject = Project::create([
            'user_id' => $otherUser->id,
            'name' => 'Proyecto Ajeno',
        ]);

        $ownerCategory = DocumentCategory::create([
            'project_id' => $ownerProject->id,
            'name' => 'Examenes Propios',
        ]);

        $otherCategory = DocumentCategory::create([
            'project_id' => $otherProject->id,
            'name' => 'Examenes Ajenos',
        ]);

        Document::create([
            'document_category_id' => $ownerCategory->id,
            'name' => 'propio.pdf',
            'file_path' => 'docs/propio.pdf',
        ]);

        Document::create([
            'document_category_id' => $otherCategory->id,
            'name' => 'ajeno.pdf',
            'file_path' => 'docs/ajeno.pdf',
        ]);

        $response = $this->actingAs($owner)->get(route('dashboard'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('stats.projects', 1)
            ->where('stats.documents', 1)
            ->has('recentProjects', 1)
        );
    }
}
