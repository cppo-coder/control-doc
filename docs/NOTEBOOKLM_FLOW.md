# NotebookLM Flow

Este documento resume el orden correcto del flujo de carga masiva cuando una categoria usa el pipeline de NotebookLM.

## Paso a paso

1. El usuario sube un PDF desde la vista de carga masiva.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Http/Controllers/DocumentBulkUploadController.php`

2. El sistema determina si la categoria debe usar pipeline NotebookLM.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMPipelineService.php`
   Metodo: `isPipelineCategory()`

3. Si aplica el pipeline, el archivo se guarda en staging local y se crea el registro `documents`.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMPipelineService.php`
   Metodo: `stageUpload()`

4. Durante el staging, se registra el tracking del documento para NotebookLM.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMAnalysisService.php`
   Metodo: `registerNotebookDocument()`

5. Para registrar ese tracking, el sistema necesita resolver el `notebook_id` de la categoria.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMBridgeService.php`
   Metodo: `ensureNotebookForCategory()`

6. Primero se valida la comunicacion/autenticacion con NotebookLM.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMAuthStatusService.php`
   Metodo: `status(fresh: true)`

7. Si la autenticacion no es valida:
   - No se consulta si existe el cuaderno.
   - No se intenta crear el cuaderno.
   - Se guarda un `notebook_id` placeholder local como `pending_category_{id}` para no romper el tracking.

8. Solo si la autenticacion es valida, se consulta si el cuaderno ya existe.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMBridgeService.php`
   Metodo: `findNotebookByTitle()`

9. Si el cuaderno no existe, recien ahi se intenta crearlo.
   Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMBridgeService.php`
   Metodo: `createNotebook()`

10. Luego se encola el job de preparacion o analisis.
    Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Jobs/AnalyzeDocumentJob.php`

11. El job entra a `prepare()` o `analyze()`.
    Archivo relacionado: `/Users/beagle/Documents/Control-doc/app/Services/NotebookLMPipelineService.php`

12. En la etapa remota, el sistema intenta subir el PDF como fuente para NotebookLM usando `add_drive_source`.
    Si la autenticacion sigue invalida, el flujo falla en este punto.

## Regla de diagnostico

Antes de diagnosticar "no existe el cuaderno", primero hay que confirmar:

- Que el binario/configuracion de NotebookLM MCP exista.
- Que la sesion/cookie tecnica este vigente.
- Que `NotebookLMAuthStatusService` responda `status = valid`.

Solo despues de eso tiene sentido revisar si el cuaderno existe o si debe crearse.

## Error actual observado en local

En este entorno local, el fallo actual es de autenticacion:

- `status: missing_cookie`
- `validation_error: No se encontro cookies.json. Ejecuta notebooklm-mcp-auth con la cuenta tecnica.`

Por lo tanto, el problema actual no es la inexistencia del cuaderno, sino la falta de comunicacion valida con NotebookLM.
