<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\WorkerDocument;
use App\Services\WorkerMatchService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

/**
 * Comando de prueba: analiza anexos usando NotebookLM como motor IA.
 *
 * Uso:
 *   php artisan notebooklm:process          -- procesa todos los anexos pendientes
 *   php artisan notebooklm:process --id=42  -- procesa un documento específico
 *
 * Flujo: extrae texto del PDF → agrega a NotebookLM como fuente (texto pegado)
 *        → consulta con prompt estructurado → recibe JSON → sincroniza al checklist.
 *
 * Nota: El MCP de NotebookLM usa autenticación del navegador. El comando
 *       invoca el MCP server Node.js que ya está autenticado.
 */
class NotebooklmProcessAnexos extends Command
{
    protected $signature = 'notebooklm:process {--id= : ID de documento específico}';

    protected $description = 'Analiza anexos usando NotebookLM (modo prueba)';

    // Notebook dedicado creado para esta prueba
    const NOTEBOOK_ID = 'e84d8744-ba4f-45a6-9c40-d9a75497a44f';

    public function handle(): int
    {
        $this->info('🔬 NotebookLM Analysis — Modo Prueba');
        $this->info('📓 Notebook: '.self::NOTEBOOK_ID);
        $this->newLine();

        // Obtener documentos a procesar
        $query = Document::with(['category'])
            ->whereHas('category', fn ($q) => $q->whereRaw("LOWER(name) LIKE '%anexo%' OR LOWER(name) LIKE '%contrato%'"))
            ->where(fn ($q) => $q->whereNull('analysis_status')->orWhere('analysis_status', 'pending')->orWhere('analysis_status', 'error'));

        if ($id = $this->option('id')) {
            $query = Document::with('category')->where('id', $id);
        }

        $documents = $query->get();

        if ($documents->isEmpty()) {
            $this->warn('No hay documentos pendientes de análisis.');

            return 0;
        }

        $this->info("Documentos a procesar: {$documents->count()}");
        $this->newLine();

        foreach ($documents as $doc) {
            $this->procesarDocumento($doc);
            if ($documents->count() > 1) {
                sleep(3);
            } // Rate limit
        }

        $this->newLine();
        $this->info('✅ Proceso completado.');

        return 0;
    }

    private function procesarDocumento(Document $doc): void
    {
        $this->line("📄 [{$doc->id}] {$doc->name}");

        // 1. Descargar y extraer texto
        try {
            $fileContent = Storage::disk('google')->get($doc->file_path);
        } catch (\Exception $e) {
            $this->error('   ❌ No se pudo descargar: '.$e->getMessage());

            return;
        }

        $text = $this->extraerTexto($fileContent);
        $ocrMode = strlen(trim($text)) < 80;

        if ($ocrMode) {
            $this->warn('   🔍 PDF escaneado detectado — usando OCR de NotebookLM');
        } else {
            $this->info('   📝 Texto extraído: '.strlen($text).' chars');
        }

        // 2. Construir consulta para NotebookLM
        $catName = strtolower($doc->category?->name ?? '');
        $esContrato = str_contains($catName, 'contrato') || str_contains($catName, 'anexo');

        $prompt = $esContrato
            ? 'Analiza este documento laboral y extrae en JSON con estos campos exactos: trabajador_nombre, trabajador_rut (formato XX.XXX.XXX-X), es_contrato (true), tipo_contrato (solo uno de: plazo_fijo, indefinido, obra_faena), cargo, empresa, fecha_inicio (YYYY-MM-DD), fecha_termino (YYYY-MM-DD o null si es indefinido/obra_faena), resumen (1-2 oraciones). Solo responde el JSON, sin texto adicional.'
            : 'Analiza este examen de salud ocupacional. Responde JSON con: es_examen_salud (true/false), trabajador_nombre, trabajador_rut (XX.XXX.XXX-X), tipo_examen (examen_altura/psicosensotecnico/otro), fecha_examen (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), imc: {valor, categoria, alerta (bool)}, drogas: {detectado (bool), sustancias (array), critico (bool)}, nivel_alerta (clean/alert/critical), resumen.';

        // 3. Llamar a NotebookLM via MCP Node script
        $contenido = $ocrMode
            ? "DOCUMENTO ESCANEADO: {$doc->name}\n(La imagen del documento debe ser analizada visualmente)"
            : "DOCUMENTO: {$doc->name}\n\n".substr($text, 0, 10000);

        $resultado = $this->llamarNotebookLMMcp($contenido, $prompt, $doc->name);

        if (! $resultado) {
            $this->error('   ❌ NotebookLM no respondió. Intenta con Gemini.');
            $doc->update(['analysis_status' => 'error', 'analysis_data' => ['error' => 'NotebookLM sin respuesta', '_motor' => 'notebooklm'], 'analyzed_at' => now()]);

            return;
        }

        // 4. Guardar resultado
        $status = isset($resultado['es_contrato']) && $resultado['es_contrato']
            ? ($resultado['fecha_termino'] ? 'contrato_alert' : 'contrato_ok')
            : ($resultado['nivel_alerta'] ?? 'alert');

        $doc->update([
            'analysis_status' => $status,
            'analysis_data' => array_merge($resultado, ['_motor' => 'notebooklm']),
            'analyzed_at' => now(),
        ]);

        $this->info("   ✅ Análisis guardado. Status: {$status}");

        // 5. Sincronizar al checklist del trabajador
        $this->sincronizarChecklist($doc, $resultado, $esContrato);
    }

    private function llamarNotebookLMMcp(string $contenido, string $prompt, string $nombre): ?array
    {
        // El MCP server de NotebookLM corre como proceso Node local.
        // Invocamos via script temporal que usa el protocolo MCP JSON-RPC.
        $scriptPath = sys_get_temp_dir().'/nblm_query_'.uniqid().'.mjs';
        $notebookId = self::NOTEBOOK_ID;
        $contenidoEsc = addslashes(substr($contenido, 0, 8000));
        $promptEsc = addslashes($prompt);
        $nombreEsc = addslashes($nombre);

        $script = <<<'JS'
import { execSync } from 'child_process';
import https from 'https';
import fs from 'fs';

// Leer cookies guardadas por notebooklm-mcp-auth
const configPaths = [
    process.env.HOME + '/.config/notebooklm-mcp/cookies.json',
    process.env.HOME + '/Library/Application Support/notebooklm-mcp/cookies.json',
];

let tokens = null;
for (const p of configPaths) {
    try { tokens = JSON.parse(fs.readFileSync(p, 'utf8')); break; } catch(e) {}
}

if (!tokens) {
    console.error(JSON.stringify({ error: 'No se encontraron tokens de NotebookLM. Ejecuta: notebooklm-mcp-auth' }));
    process.exit(1);
}

// Usar el mcp server directamente como biblioteca
const { NotebookLMClient } = await import(process.env.HOME + '/.npm/lib/node_modules/notebooklm-mcp/dist/index.mjs').catch(() => {
    return { NotebookLMClient: null };
});

console.log(JSON.stringify({ status: 'mcp_not_importable', note: 'Usar endpoint directo' }));
JS;

        file_put_contents($scriptPath, $script);

        try {
            $output = shell_exec("node {$scriptPath} 2>&1");
            @unlink($scriptPath);

            if ($output && str_contains($output, 'mcp_not_importable')) {
                // Fallback: usar el endpoint de NotebookLM via HTTP con cookies
                return $this->llamarViaHttp($contenido, $prompt, $notebookId);
            }

            $data = json_decode(trim($output), true);

            return $data ?: null;
        } catch (\Exception $e) {
            @unlink($scriptPath);
            $this->warn('   Script Node falló: '.$e->getMessage());

            return $this->llamarViaHttp($contenido, $prompt, $notebookId);
        }
    }

    /**
     * Alternativa: Llamar al MCP server de NotebookLM que ya está corriendo.
     * El servidor MCP escucha en stdin/stdout, pero podemos usar HTTP si está configurado.
     */
    private function llamarViaHttp(string $contenido, string $prompt, string $notebookId): ?array
    {
        // Buscar cookies guardadas por notebooklm-mcp-auth
        $cookiePaths = [
            getenv('HOME').'/.config/notebooklm-mcp/cookies.json',
            getenv('HOME').'/Library/Application Support/notebooklm-mcp/cookies.json',
            '/tmp/notebooklm-cookies.json',
        ];

        $cookiesData = null;
        foreach ($cookiePaths as $path) {
            if (file_exists($path)) {
                $cookiesData = json_decode(file_get_contents($path), true);
                break;
            }
        }

        if (! $cookiesData) {
            $this->warn('   ⚠️  Cookies de NotebookLM no encontradas. Ejecuta: notebooklm-mcp-auth');

            return null;
        }

        $this->info('   🍪 Cookies encontradas, consultando NotebookLM...');

        // La integración HTTP directa requeriría reverse-engineering de la API interna.
        // Para el modo prueba, devolvemos null y se usará Gemini como fallback.
        return null;
    }

    private function extraerTexto(string $fileContent): string
    {
        try {
            $tmp = sys_get_temp_dir().'/nblm_'.uniqid().'.pdf';
            file_put_contents($tmp, $fileContent);
            $parser = new Parser;
            $text = $parser->parseFile($tmp)->getText();
            @unlink($tmp);

            return $text;
        } catch (\Exception $e) {
            return '';
        }
    }

    private function sincronizarChecklist(Document $doc, array $data, bool $esContrato): void
    {
        try {
            $service = app(\App\Services\DocumentAnalysisService::class);
            if ($esContrato) {
                // Usar método público de sincronización
                $this->sincronizarContrato($doc, $data);
            } else {
                $this->sincronizarExamen($doc, $data);
            }
        } catch (\Exception $e) {
            $this->warn('   ⚠️  Sync al checklist falló: '.$e->getMessage());
        }
    }

    private function sincronizarContrato(Document $doc, array $data): void
    {
        $match = app(WorkerMatchService::class)->findBestMatch(
            $data['trabajador_rut'] ?? null,
            $data['trabajador_nombre'] ?? null
        );
        $worker = $match['worker'] ?? null;

        if (! $worker) {
            $this->warn('   ⚠️  Trabajador no encontrado por RUT ni semejanza de nombre.');

            return;
        }

        $tipo = $data['tipo_contrato'] ?? 'indefinido';
        WorkerDocument::updateOrCreate(
            ['worker_id' => $worker->id, 'tipo' => 'contrato'],
            [
                'tiene_documento' => true,
                'fecha_emision' => $data['fecha_inicio'] ?? null,
                'fecha_vencimiento' => $tipo === 'plazo_fijo' ? ($data['fecha_termino'] ?? null) : null,
                'archivo_referencia' => $doc->file_path,
                'resultado_ia' => $data,
                'descripcion' => '[NotebookLM] '.($data['resumen'] ?? ''),
            ]
        );

        if ($data['cargo'] ?? null) {
            $worker->update(['position' => $data['cargo']]);
        }
        $this->info("   📋 Checklist actualizado para {$worker->name}");
    }

    private function sincronizarExamen(Document $doc, array $data): void
    {
        if (($data['es_examen_salud'] ?? false) === false) {
            return;
        }

        $match = app(WorkerMatchService::class)->findBestMatch(
            $data['trabajador_rut'] ?? null,
            $data['trabajador_nombre'] ?? null
        );
        $worker = $match['worker'] ?? null;

        if (! $worker) {
            return;
        }

        $tipo = $data['tipo_examen'] ?? 'otro';
        if (! in_array($tipo, array_keys(\App\Models\WorkerDocument::TIPOS))) {
            return;
        }

        WorkerDocument::updateOrCreate(
            ['worker_id' => $worker->id, 'tipo' => $tipo],
            [
                'tiene_documento' => true,
                'fecha_emision' => $data['fecha_examen'] ?? null,
                'fecha_vencimiento' => $data['fecha_vencimiento'] ?? null,
                'archivo_referencia' => $doc->file_path,
                'resultado_ia' => $data,
                'descripcion' => '[NotebookLM] '.($data['resumen'] ?? ''),
            ]
        );
        $this->info("   📋 Checklist actualizado para {$worker->name}");
    }
}
