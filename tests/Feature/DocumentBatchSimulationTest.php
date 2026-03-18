<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Project;
use App\Models\User;
use App\Services\NotebookLMAuthStatusService;
use App\Services\NotebookLMPipelineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class DocumentBatchSimulationTest extends TestCase
{
    use RefreshDatabase;

    private const INPUT_FILES = [
        '/Users/beagle/Downloads/ex daniel.pdf',
        '/Users/beagle/Downloads/Informe_000146117_Luis_Yanez_Nunez.pdf',
        '/Users/beagle/Downloads/EXAMEN GONZALO.pdf',
        '/Users/beagle/Downloads/EX.MARIO ROJAS.pdf',
        '/Users/beagle/Downloads/ANEXO camilo ortiz.pdf',
        '/Users/beagle/Downloads/EX. MAXIMILANO ROJAS 17-11-26[82].pdf',
    ];

    private const FINAL_ANALYSIS_STATUSES = ['clean', 'alert', 'critical', 'rejected', 'error', 'duplicate'];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('google');

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

    public function test_real_local_pdf_batch_reaches_summary_ready_state(): void
    {
        foreach (self::INPUT_FILES as $path) {
            $this->assertFileExists($path, "No existe el archivo de simulacion: {$path}");
        }

        $owner = User::factory()->create();
        $project = Project::create([
            'user_id' => $owner->id,
            'name' => 'Simulacion Lote',
        ]);

        $category = DocumentCategory::create([
            'project_id' => $project->id,
            'name' => 'Examen de Altura Geografica',
        ]);

        $expectedAccepted = [
            'ex daniel.pdf' => [
                'status' => 'clean',
                'summary' => 'Examen medico aceptado y disponible para revision.',
            ],
            'EXAMEN GONZALO.pdf' => [
                'status' => 'alert',
                'summary' => 'Examen aceptado con observaciones menores.',
            ],
            'EX.MARIO ROJAS.pdf' => [
                'status' => 'alert',
                'summary' => 'Examen aceptado con hallazgos a revisar.',
            ],
            'EX. MAXIMILANO ROJAS 17-11-26[82].pdf' => [
                'status' => 'critical',
                'summary' => 'Examen aceptado con condicion critica para revision.',
            ],
        ];

        $expectedRejected = [
            'Informe_000146117_Luis_Yanez_Nunez.pdf' => 'El documento no corresponde a un examen medico de esta carpeta.',
            'ANEXO camilo ortiz.pdf' => 'El documento corresponde a un anexo y no a un examen medico.',
        ];

        $this->bindSimulatedPipeline($category, $expectedAccepted, $expectedRejected);

        $uploadResponses = [];
        $acceptedDocumentIds = [];

        foreach (self::INPUT_FILES as $path) {
            $response = $this
                ->actingAs($owner)
                ->postJson(route('documents.store', $category), [
                    'document' => $this->realUploadedPdf($path),
                ]);

            $response->assertOk();
            $payload = $response->json();
            $filename = basename($path);

            $uploadResponses[$filename] = $payload;

            if (($payload['success'] ?? false) === true && ! empty($payload['document_id'])) {
                $acceptedDocumentIds[] = (int) $payload['document_id'];
            }
        }

        $this->assertCount(4, $acceptedDocumentIds);

        foreach ($expectedRejected as $filename => $reason) {
            $this->assertSame('rejected', $uploadResponses[$filename]['status'] ?? null);
            $this->assertSame($reason, $uploadResponses[$filename]['analysis_data']['motivo_rechazo'] ?? null);
        }

        $this
            ->actingAs($owner)
            ->postJson(route('documents.bulk-analyze', $category), [
                'document_ids' => $acceptedDocumentIds,
            ])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'queued' => 0,
            ]);

        $snapshots = collect($acceptedDocumentIds)
            ->mapWithKeys(function (int $documentId) use ($owner) {
                $response = $this->actingAs($owner)
                    ->getJson(route('documents.show', $documentId))
                    ->assertOk();

                return [$documentId => $response->json()];
            });

        $this->assertTrue($snapshots->every(
            fn (array $snapshot) => in_array($snapshot['analysis_status'] ?? null, self::FINAL_ANALYSIS_STATUSES, true)
        ));

        $this->assertTrue($snapshots->every(
            fn (array $snapshot) => ($snapshot['pipeline_status'] ?? null) === 'stored_in_drive'
        ));

        foreach ($expectedAccepted as $filename => $expected) {
            $document = Document::query()->where('name', $filename)->firstOrFail();
            $snapshot = $snapshots->get($document->id);

            $this->assertSame($expected['status'], $snapshot['analysis_status'] ?? null);
            $this->assertSame($expected['summary'], $snapshot['analysis_data']['resumen'] ?? null);
        }

        $modalSummary = [
            'accepted' => $snapshots->count(),
            'rejected' => count($expectedRejected),
            'errors' => $snapshots->filter(fn (array $snapshot) => ($snapshot['analysis_status'] ?? null) === 'error')->count(),
            'total' => count(self::INPUT_FILES),
        ];

        $this->assertSame([
            'accepted' => 4,
            'rejected' => 2,
            'errors' => 0,
            'total' => 6,
        ], $modalSummary);
    }

    private function bindSimulatedPipeline(DocumentCategory $category, array $expectedAccepted, array $expectedRejected): void
    {
        $enqueue = null;

        $enqueue = function (Document $document, string $mode = 'prepare') use (&$enqueue, $expectedAccepted): void {
            $document->loadMissing('category.project', 'notebooklmDocument');

            $tracking = $document->notebooklmDocument;

            if ($mode === 'prepare') {
                $tracking?->update([
                    'sync_status' => 'ready_for_query',
                    'sync_error' => null,
                ]);

                $document->update([
                    'analysis_status' => 'pending',
                ]);

                $enqueue($document->fresh(['category.project', 'notebooklmDocument']), 'analyze');

                return;
            }

            $profile = $expectedAccepted[$document->name] ?? [
                'status' => 'error',
                'summary' => 'No se encontro una simulacion para este archivo.',
            ];

            $finalPath = $document->category->project->name.'/'.$document->category->name.'/'.Str::uuid().'_'.$document->name;
            Storage::disk('google')->put($finalPath, 'simulated-pdf-content');

            $document->update([
                'file_path' => $finalPath,
                'analysis_status' => $profile['status'],
                'analysis_data' => array_merge($document->analysis_data ?? [], [
                    'resumen' => $profile['summary'],
                    'origen' => 'simulacion-backend',
                ]),
                'analyzed_at' => now(),
            ]);

            $tracking?->update([
                'sync_status' => 'stored_in_drive',
                'sync_error' => null,
                'synced_at' => now(),
            ]);
        };

        $service = Mockery::mock(NotebookLMPipelineService::class);
        $service->shouldReceive('isPipelineCategory')
            ->andReturnTrue();

        $service->shouldReceive('preflightUpload')
            ->andReturnUsing(function (DocumentCategory $incomingCategory, UploadedFile $file) use ($expectedRejected) {
                $filename = $file->getClientOriginalName();

                if (! array_key_exists($filename, $expectedRejected)) {
                    return null;
                }

                return [
                    'success' => false,
                    'rejected' => true,
                    'status' => 'rejected',
                    'pipeline_status' => null,
                    'filename' => $filename,
                    'worker_name' => null,
                    'resumen' => $expectedRejected[$filename],
                    'alerts' => [
                        [
                            'type' => 'warning',
                            'msg' => $expectedRejected[$filename],
                        ],
                    ],
                    'analysis_data' => [
                        'es_examen_salud' => false,
                        'motivo_rechazo' => $expectedRejected[$filename],
                        'resumen' => $expectedRejected[$filename],
                    ],
                ];
            });

        $service->shouldReceive('stageUpload')
            ->andReturnUsing(function (DocumentCategory $incomingCategory, UploadedFile $file) use ($category) {
                $category->loadMissing('project');

                $stagedPath = NotebookLMPipelineService::STAGING_PREFIX
                    .'/'.$category->project->name
                    .'/'.$category->name
                    .'/'.Str::uuid().'_'.$file->getClientOriginalName();

                Storage::disk('local')->put($stagedPath, file_get_contents($file->getRealPath()));

                $document = $incomingCategory->documents()->create([
                    'name' => $file->getClientOriginalName(),
                    'file_path' => $stagedPath,
                    'analysis_status' => 'pending',
                    'analysis_data' => [
                        '_file' => [
                            'hash' => md5_file($file->getRealPath()) ?: md5((string) file_get_contents($file->getRealPath())),
                            'original_name' => $file->getClientOriginalName(),
                        ],
                    ],
                ]);

                $document->notebooklmDocument()->create([
                    'notebook_id' => 'nb_sim_'.$document->id,
                    'source_id' => 'src_pending_'.$document->id,
                    'sync_status' => 'received',
                    'sync_error' => null,
                ]);

                return $document->fresh(['notebooklmDocument']);
            });

        $service->shouldReceive('enqueue')
            ->andReturnUsing($enqueue);

        $this->instance(NotebookLMPipelineService::class, $service);
    }

    private function realUploadedPdf(string $path): UploadedFile
    {
        return new UploadedFile(
            $path,
            basename($path),
            'application/pdf',
            null,
            true
        );
    }
}
