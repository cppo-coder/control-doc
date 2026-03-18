<?php

namespace Tests\Unit;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\NotebookLMDocument;
use App\Models\Project;
use App\Models\User;
use App\Services\NotebookLMAnalysisService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotebookLMAnalysisServiceCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function service(): object
    {
        return new class extends NotebookLMAnalysisService
        {
            public function hasTrackingColumns(): bool
            {
                return true;
            }

            public function validateCategory(Document $document, array $analysisData): array
            {
                return $this->enforceCategoryRules($document, $analysisData);
            }

            public function latestExpiry(mixed $current, mixed $incoming): ?string
            {
                return $this->latestDate($current, $incoming);
            }

            public function register(Document $document): ?NotebookLMDocument
            {
                return $this->registerNotebookDocument($document);
            }
        };
    }

    public function test_anexo_category_rejects_contract_documents(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'user_id' => $user->id,
            'name' => 'Proyecto Demo',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Anexos',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'contrato.pdf',
            'file_path' => 'Proyecto Demo/Anexos/contrato.pdf',
            'analysis_status' => 'pending',
        ]);

        $result = $this->service()->validateCategory($document, [
            'es_contrato' => true,
            'tipo_documento_detectado' => 'contrato',
            'trabajador_nombre' => 'Mario Demo',
            'trabajador_rut' => '18403453-0',
        ]);

        $this->assertFalse($result['es_contrato']);
        $this->assertSame('rejected', $result['nivel_alerta']);
        $this->assertSame('El archivo no corresponde a la categoria Anexo.', $result['motivo_rechazo']);
    }

    public function test_contract_expiry_keeps_latest_existing_date(): void
    {
        $this->assertSame('2026-12-31', $this->service()->latestExpiry('2026-12-31', '2026-03-01'));
        $this->assertSame('2027-02-01', $this->service()->latestExpiry('2026-12-31', '2027-02-01'));
    }

    public function test_register_notebook_document_preserves_existing_real_source_id(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'user_id' => $user->id,
            'name' => 'Proyecto Demo',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen de Altura Geografica',
        ]);

        $document = Document::create([
            'document_category_id' => $category->id,
            'name' => 'examen.pdf',
            'file_path' => 'Proyecto Demo/Examenes/examen.pdf',
            'analysis_status' => 'pending',
        ]);

        NotebookLMDocument::query()->create([
            'document_id' => $document->id,
            'notebook_id' => 'nb_batch_1',
            'source_id' => 'src_real_123',
            'sync_status' => 'ready_for_query',
            'sync_error' => null,
        ]);

        $document->update([
            'analysis_data' => [
                '_pipeline' => [
                    'notebook_id' => 'nb_batch_1',
                ],
            ],
        ]);

        $tracking = $this->service()->register($document);

        $this->assertNotNull($tracking);
        $this->assertSame('src_real_123', $tracking->source_id);
        $this->assertSame('ready_for_query', $tracking->sync_status);
    }
}
