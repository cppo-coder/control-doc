<?php

namespace Tests\Unit;

use App\Models\DocumentCategory;
use App\Models\NotebookLMConfig;
use App\Models\Project;
use App\Models\User;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMBridgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotebookLMBridgeServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reuses_an_existing_notebook_found_by_title(): void
    {
        $category = $this->makeCategory('Examen Altura');

        $service = new class($this->makeAuthStatusService('valid')) extends NotebookLMBridgeService
        {
            protected function findNotebookByTitle(string $title): ?array
            {
                return ['id' => 'nb_existing_123', 'title' => $title];
            }

            protected function createNotebook(string $title): ?array
            {
                throw new \RuntimeException('No debía crear un cuaderno cuando ya existe.');
            }
        };

        $config = $service->ensureNotebookForCategory($category);

        $this->assertSame('nb_existing_123', $config?->notebook_id);
        $this->assertDatabaseHas('notebook_l_m_configs', [
            'document_category_id' => $category->id,
            'notebook_id' => 'nb_existing_123',
            'notebook_title' => 'Examenes (Auto DB)',
        ]);
    }

    public function test_it_creates_a_notebook_when_none_exists_for_the_category(): void
    {
        $category = $this->makeCategory('Contratos');

        $service = new class($this->makeAuthStatusService('valid')) extends NotebookLMBridgeService
        {
            protected function findNotebookByTitle(string $title): ?array
            {
                return ['status' => 'missing'];
            }

            protected function createNotebook(string $title): ?array
            {
                return ['id' => 'nb_created_456', 'title' => $title];
            }
        };

        $config = $service->ensureNotebookForCategory($category);

        $this->assertSame('nb_created_456', $config?->notebook_id);
        $this->assertDatabaseHas('notebook_l_m_configs', [
            'document_category_id' => $category->id,
            'notebook_id' => 'nb_created_456',
            'notebook_title' => 'Contratos y Anexos (Auto DB)',
        ]);
    }

    public function test_it_checks_auth_before_querying_or_creating_the_notebook(): void
    {
        $category = $this->makeCategory('Examen Altura');

        $service = new class($this->makeAuthStatusService('missing_cookie')) extends NotebookLMBridgeService
        {
            protected function findNotebookByTitle(string $title): ?array
            {
                throw new \RuntimeException('No debe consultar cuadernos si la autenticacion fallo.');
            }

            protected function createNotebook(string $title): ?array
            {
                throw new \RuntimeException('No debe crear cuadernos si la autenticacion fallo.');
            }
        };

        $config = $service->ensureNotebookForCategory($category);

        $this->assertSame('pending_category_'.$category->id, $config?->notebook_id);
        $this->assertDatabaseHas('notebook_l_m_configs', [
            'document_category_id' => $category->id,
            'notebook_id' => 'pending_category_'.$category->id,
            'notebook_title' => 'Examenes (Auto DB)',
        ]);
    }

    public function test_it_repairs_a_stale_notebook_id_when_auth_is_valid(): void
    {
        $category = $this->makeCategory('Examen Altura');

        NotebookLMConfig::query()->create([
            'document_category_id' => $category->id,
            'notebook_id' => 'nb_stale_old',
            'notebook_title' => 'Examenes (Auto DB)',
        ]);

        $service = new class($this->makeAuthStatusService('valid')) extends NotebookLMBridgeService
        {
            protected function findNotebookByTitle(string $title): ?array
            {
                return ['id' => 'nb_fresh_789', 'title' => $title];
            }

            protected function createNotebook(string $title): ?array
            {
                throw new \RuntimeException('No debía crear un cuaderno si ya existe por titulo.');
            }
        };

        $config = $service->ensureNotebookForCategory($category);

        $this->assertSame('nb_fresh_789', $config?->notebook_id);
        $this->assertDatabaseHas('notebook_l_m_configs', [
            'document_category_id' => $category->id,
            'notebook_id' => 'nb_fresh_789',
            'notebook_title' => 'Examenes (Auto DB)',
        ]);
    }

    private function makeAuthStatusService(string $status): NotebookLMAuthStatusService
    {
        $service = $this->createMock(NotebookLMAuthStatusService::class);
        $service
            ->method('status')
            ->willReturn([
                'status' => $status,
                'ok' => $status === 'valid',
                'renewal_required' => $status !== 'valid',
            ]);

        return $service;
    }

    private function makeCategory(string $name): DocumentCategory
    {
        $user = User::factory()->create();
        $project = Project::create([
            'user_id' => $user->id,
            'name' => 'Proyecto NotebookLM',
        ]);

        return DocumentCategory::create([
            'project_id' => $project->id,
            'name' => $name,
        ]);
    }
}
