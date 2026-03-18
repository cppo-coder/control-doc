<?php

namespace Tests\Unit;

use App\Services\DocumentAnalysisService;
use App\Services\NotebookLMAnalysisService;
use App\Services\NotebookLMBridgeService;
use App\Services\NotebookLMPipelineService;
use Tests\TestCase;

class NotebookLMPipelineServiceTest extends TestCase
{
    public function test_pipeline_does_not_run_inline_by_default(): void
    {
        putenv('NOTEBOOKLM_PIPELINE_INLINE');
        $_ENV['NOTEBOOKLM_PIPELINE_INLINE'] = null;
        $_SERVER['NOTEBOOKLM_PIPELINE_INLINE'] = null;

        $service = new class($this->createMock(NotebookLMAnalysisService::class), $this->createMock(DocumentAnalysisService::class), $this->createMock(NotebookLMBridgeService::class)) extends NotebookLMPipelineService
        {
            public function shouldProcessInlinePublic(): bool
            {
                return $this->shouldProcessInline();
            }
        };

        $this->assertFalse($service->shouldProcessInlinePublic());
    }

    public function test_pipeline_inline_mode_can_be_forced_by_env(): void
    {
        putenv('NOTEBOOKLM_PIPELINE_INLINE=true');
        $_ENV['NOTEBOOKLM_PIPELINE_INLINE'] = 'true';
        $_SERVER['NOTEBOOKLM_PIPELINE_INLINE'] = 'true';

        $service = new class($this->createMock(NotebookLMAnalysisService::class), $this->createMock(DocumentAnalysisService::class), $this->createMock(NotebookLMBridgeService::class)) extends NotebookLMPipelineService
        {
            public function shouldProcessInlinePublic(): bool
            {
                return $this->shouldProcessInline();
            }
        };

        $this->assertTrue($service->shouldProcessInlinePublic());

        putenv('NOTEBOOKLM_PIPELINE_INLINE');
        $_ENV['NOTEBOOKLM_PIPELINE_INLINE'] = null;
        $_SERVER['NOTEBOOKLM_PIPELINE_INLINE'] = null;
    }
}
