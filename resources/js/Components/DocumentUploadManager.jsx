import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { createPortal } from 'react-dom';
import axios from 'axios';

const DocumentUploadManagerContext = createContext(null);
const uploadStoreListeners = new Set();
let uploadStoreState = {
    activeTaskId: null,
    task: null,
    showCompletionNotice: false,
    showRejectedModal: false,
};

const PANEL_STATUS = {
    clean: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', label: 'Sin alertas' },
    alert: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Alerta' },
    critical: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'Critico' },
    review: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Revision manual' },
    rejected: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400', label: 'Rechazado' },
    error: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Error' },
    pending: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400', label: 'En progreso' },
    ready_for_query: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500', label: 'Listo para IA' },
    indexing: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400', label: 'Indexando' },
    uploaded_to_notebook: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', label: 'En NotebookLM' },
    stored_in_drive: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Disponible' },
};

const FINAL_ANALYSIS_STATUSES = ['clean', 'alert', 'critical', 'review', 'rejected', 'error', 'duplicate'];

const isPipelineCategoryName = (categoryName) => {
    const normalized = String(categoryName ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return normalized.includes('examen') || normalized.includes('contrato') || normalized.includes('anexo');
};

const getXsrfToken = () => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
};

const resolveSnapshotStatus = (snapshot, fallbackStatus = null) => {
    if (snapshot?.pipeline_status === 'failed') {
        return 'error';
    }

    return snapshot?.analysis_status ?? fallbackStatus;
};

const emitUploadStore = () => {
    uploadStoreListeners.forEach((listener) => listener(uploadStoreState));
};

const patchUploadStore = (patch) => {
    uploadStoreState = {
        ...uploadStoreState,
        ...(typeof patch === 'function' ? patch(uploadStoreState) : patch),
    };

    emitUploadStore();
};

const updateStoredTask = (taskId, updater) => {
    patchUploadStore((current) => {
        if (!current.task || current.task.id !== taskId) {
            return current;
        }

        return {
            task: typeof updater === 'function' ? updater(current.task) : updater,
        };
    });
};

export function DocumentUploadManagerProvider({ children }) {
    const [storeState, setStoreState] = useState(uploadStoreState);
    const { activeTaskId, task, showCompletionNotice, showRejectedModal } = storeState;

    useEffect(() => {
        const syncState = (nextState) => setStoreState(nextState);

        uploadStoreListeners.add(syncState);

        return () => {
            uploadStoreListeners.delete(syncState);
        };
    }, []);

    const clearTask = () => {
        patchUploadStore({
            activeTaskId: null,
            task: null,
            showCompletionNotice: false,
            showRejectedModal: false,
        });
    };

    const refreshCategoriesIfVisible = () => {
        if (!window.location.pathname.includes('/categories')) {
            return;
        }

        router.reload({
            only: ['categories'],
            preserveScroll: true,
            preserveState: true,
        });
    };

    const uploadFile = (taskId, category, item, index) => new Promise((resolve) => {
        const formData = new FormData();
        formData.append('document', item.file);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) {
                return;
            }

            updateStoredTask(taskId, (current) => ({
                ...current,
                fileStates: current.fileStates.map((fileState, fileIndex) => (
                    fileIndex === index
                        ? { ...fileState, progress: Math.round((event.loaded / event.total) * 100) }
                        : fileState
                )),
            }));
        };

        xhr.onload = () => {
            const ok = xhr.status >= 200 && xhr.status < 300;
            let payload = {};

            try {
                payload = JSON.parse(xhr.responseText);
            } catch (_) {
                payload = {};
            }

            updateStoredTask(taskId, (current) => ({
                ...current,
                fileStates: current.fileStates.map((fileState, fileIndex) => (
                    fileIndex === index
                        ? {
                            ...fileState,
                            progress: 100,
                            status: ok ? 'done' : 'error',
                            error: payload.errors?.document?.[0] ?? payload.error ?? null,
                            resultStatus: payload.status ?? (ok ? 'pending' : 'error'),
                            resultSummary: payload.resumen ?? payload.analysis_data?.resumen ?? null,
                            resultReason: payload.analysis_data?.motivo_rechazo ?? payload.motivo_rechazo ?? null,
                            resultAlerts: Array.isArray(payload.alerts) ? payload.alerts : [],
                            documentId: payload.document_id ?? null,
                            pipelineStatus: payload.pipeline_status ?? null,
                        }
                        : fileState
                )),
            }));

            resolve();
        };

        xhr.onerror = () => {
            updateStoredTask(taskId, (current) => ({
                ...current,
                fileStates: current.fileStates.map((fileState, fileIndex) => (
                    fileIndex === index
                        ? {
                            ...fileState,
                            status: 'error',
                            error: 'Error de red',
                            resultStatus: 'error',
                            resultSummary: null,
                            resultReason: null,
                            resultAlerts: [],
                            documentId: null,
                            pipelineStatus: null,
                        }
                        : fileState
                )),
            }));

            resolve();
        };

        updateStoredTask(taskId, (current) => ({
            ...current,
            fileStates: current.fileStates.map((fileState, fileIndex) => (
                fileIndex === index
                    ? { ...fileState, status: 'uploading' }
                    : fileState
            )),
        }));

        xhr.open('POST', route('documents.store', category.id));
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-XSRF-TOKEN', getXsrfToken());
        xhr.withCredentials = true;
        xhr.send(formData);
    });

    const startDocumentUpload = ({ category, files }) => {
        if (!category?.id || !Array.isArray(files) || files.length === 0) {
            return false;
        }

        if (activeTaskId) {
            return false;
        }

        const taskId = Date.now();

        const nextTask = {
            id: taskId,
            category: { id: category.id, name: category.name },
            minimized: true,
            uploading: true,
            fileStates: files.map((file) => ({
                file,
                progress: 0,
                status: 'waiting',
                error: null,
                resultStatus: null,
                resultSummary: null,
                resultReason: null,
                resultAlerts: [],
                documentId: null,
                pipelineStatus: null,
            })),
        };

        patchUploadStore({
            activeTaskId: taskId,
            task: nextTask,
            showCompletionNotice: false,
            showRejectedModal: false,
        });

        void (async () => {
            for (let index = 0; index < files.length; index += 1) {
                await uploadFile(taskId, category, { file: files[index] }, index);

                if (index < files.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }

            const uploadedTask = uploadStoreState.task;
            const shouldRunPipeline = isPipelineCategoryName(category.name);
            const analyzableDocumentIds = (uploadedTask?.fileStates ?? [])
                .filter((fileState) => fileState.documentId && !['rejected', 'review'].includes(fileState.resultStatus) && fileState.status !== 'error')
                .map((fileState) => fileState.documentId);

            updateStoredTask(taskId, (current) => ({
                ...current,
                uploading: false,
                processing: shouldRunPipeline && analyzableDocumentIds.length > 0,
                minimized: true,
            }));

            if (shouldRunPipeline && analyzableDocumentIds.length > 0) {
                try {
                    await axios.post(
                        route('documents.bulk-analyze', category.id),
                        { document_ids: analyzableDocumentIds },
                        { headers: { Accept: 'application/json' } }
                    );

                    const maxAttempts = import.meta.env.MODE === 'test' ? 3 : 30;

                    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                        // eslint-disable-next-line no-await-in-loop
                        await Promise.all(analyzableDocumentIds.map(async (documentId) => {
                            try {
                                const response = await axios.get(route('documents.show', documentId), {
                                    headers: { Accept: 'application/json' },
                                });
                                const snapshot = response.data;

                                updateStoredTask(taskId, (current) => ({
                                    ...current,
                                    fileStates: current.fileStates.map((fileState) => (
                                        fileState.documentId === documentId
                                            ? {
                                                ...fileState,
                                                resultStatus: resolveSnapshotStatus(snapshot, fileState.resultStatus),
                                                resultSummary: snapshot.analysis_data?.resumen ?? snapshot.analysis_data?.motivo_rechazo ?? fileState.resultSummary,
                                                resultReason: snapshot.analysis_data?.motivo_rechazo ?? snapshot.pipeline_error ?? fileState.resultReason,
                                                resultAlerts: snapshot.analysis_data?.resumen
                                                    ? [{ type: 'info', msg: snapshot.analysis_data.resumen }]
                                                    : snapshot.pipeline_error
                                                        ? [{ type: 'error', msg: snapshot.pipeline_error }]
                                                    : fileState.resultAlerts,
                                                pipelineStatus: snapshot.pipeline_status ?? fileState.pipelineStatus,
                                                error: snapshot.pipeline_error ?? fileState.error,
                                            }
                                            : fileState
                                    )),
                                }));
                            } catch (_) {
                                return null;
                            }

                            return null;
                        }));

                        const latestTask = uploadStoreState.task;
                        const trackedStates = (latestTask?.fileStates ?? []).filter((fileState) => analyzableDocumentIds.includes(fileState.documentId));
                        const completed = trackedStates.length > 0 && trackedStates.every((fileState) => FINAL_ANALYSIS_STATUSES.includes(fileState.resultStatus));

                        if (completed) {
                            break;
                        }

                        // eslint-disable-next-line no-await-in-loop
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                    }

                    updateStoredTask(taskId, (current) => ({
                        ...current,
                        fileStates: current.fileStates.map((fileState) => (
                            analyzableDocumentIds.includes(fileState.documentId) && !FINAL_ANALYSIS_STATUSES.includes(fileState.resultStatus)
                                ? {
                                    ...fileState,
                                    resultStatus: 'error',
                                    resultSummary: fileState.resultSummary ?? 'El documento no termino de procesarse dentro del tiempo esperado.',
                                    resultAlerts: fileState.resultAlerts?.length > 0
                                        ? fileState.resultAlerts
                                        : [{ type: 'error', msg: 'El procesamiento quedo incompleto o con incidencia.' }],
                                    error: fileState.error ?? 'Procesamiento incompleto.',
                                }
                                : fileState
                        )),
                    }));
                } catch (_) {
                    updateStoredTask(taskId, (current) => ({
                        ...current,
                        fileStates: current.fileStates.map((fileState) => (
                            analyzableDocumentIds.includes(fileState.documentId)
                                ? {
                                    ...fileState,
                                    resultStatus: 'error',
                                    error: fileState.error ?? 'No fue posible iniciar el analisis automatico.',
                                }
                                : fileState
                        )),
                    }));
                }
            }

            updateStoredTask(taskId, (current) => ({
                ...current,
                processing: false,
            }));

            patchUploadStore({ showCompletionNotice: true });
            refreshCategoriesIfVisible();
        })();

        return true;
    };

    useEffect(() => {
        if (!task || task.uploading || task.processing) {
            return;
        }

        patchUploadStore({
            showRejectedModal: task.fileStates.some((fileState) => ['rejected', 'review'].includes(fileState.resultStatus)),
        });
    }, [task]);

    const contextValue = useMemo(() => ({
        startDocumentUpload,
        hasActiveUpload: Boolean(task?.uploading || task?.processing),
    }), [activeTaskId, task]);

    const currentFileStates = task?.fileStates ?? [];
    const uploadedCount = currentFileStates.filter((fileState) => fileState.status === 'done').length;
    const errorCount = currentFileStates.filter((fileState) => fileState.status === 'error' || fileState.resultStatus === 'error').length;
    const waitingCount = currentFileStates.filter((fileState) => fileState.status === 'waiting').length;
    const uploadingCount = currentFileStates.filter((fileState) => fileState.status === 'uploading').length;
    const rejectedCount = currentFileStates.filter((fileState) => fileState.resultStatus === 'rejected').length;
    const progressValue = currentFileStates.length > 0
        ? Math.round(currentFileStates.reduce((carry, fileState) => {
            if (task?.processing) {
                return carry + (FINAL_ANALYSIS_STATUSES.includes(fileState.resultStatus) ? 100 : 55);
            }

            return carry + (fileState.status === 'done' ? 100 : fileState.progress);
        }, 0) / currentFileStates.length)
        : 0;
    const acceptedResults = currentFileStates
        .filter((fileState) => fileState.status === 'done' && !['rejected', 'review'].includes(fileState.resultStatus))
        .map((fileState) => ({
            filename: fileState.file.name,
            resumen: fileState.resultSummary,
            alerts: fileState.resultAlerts,
        }));
    const reviewResults = currentFileStates
        .filter((fileState) => fileState.resultStatus === 'review')
        .map((fileState) => ({
            filename: fileState.file.name,
            resumen: fileState.resultSummary,
            alerts: fileState.resultAlerts,
            analysis_data: { motivo_rechazo: fileState.resultReason },
        }));
    const rejectedResults = currentFileStates
        .filter((fileState) => fileState.resultStatus === 'rejected')
        .map((fileState) => ({
            filename: fileState.file.name,
            resumen: fileState.resultSummary,
            alerts: fileState.resultAlerts,
            analysis_data: { motivo_rechazo: fileState.resultReason },
        }));

    const overlay = (
        <DocumentUploadManagerContext.Provider value={contextValue}>
            {children}
            {task && (
                <>
                    {showCompletionNotice && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B0F19]/45 p-4 backdrop-blur-[4px]">
                            <div className="w-full max-w-3xl rounded-[30px] border border-[#E2E8F0] bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">Disponible para revision</p>
                                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">Los documentos ya estan listos para revision</h3>
                                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                                            El procesamiento en segundo plano finalizo. Aqui tienes el resumen final de los documentos disponibles.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: false })}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <SummaryCard tone="green" value={acceptedResults.length} label="Aceptados" />
                                    <SummaryCard tone="yellow" value={reviewResults.length} label="Revision manual" />
                                    <SummaryCard tone="orange" value={rejectedCount} label="Rechazados" />
                                    <SummaryCard tone="red" value={errorCount} label="Errores" />
                                </div>

                                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                                    <SummaryList title="Documentos OK" tone="green" results={acceptedResults} emptyCopy="No hubo archivos aceptados en este lote." />
                                    <SummaryList title="Revisión manual" tone="yellow" results={reviewResults} emptyCopy="No hubo archivos en revisión manual." />
                                    <SummaryList title="Documentos rechazados" tone="orange" results={rejectedResults} emptyCopy="No hubo archivos rechazados." />
                                </div>

                                <div className="mt-5 flex justify-end gap-3">
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: false })}
                                        className="h-10 rounded-xl bg-[#F3F4F6] px-5 text-[11px] font-extrabold uppercase tracking-widest text-[#374151] transition hover:bg-[#E5E7EB]"
                                    >
                                        Cerrar aviso
                                    </button>
                                    <button
                                        onClick={clearTask}
                                        className="h-10 rounded-xl bg-[#059669] px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#047857]"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showRejectedModal && (
                        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0B0F19]/50 p-4 backdrop-blur-[4px]">
                            <div className="w-full max-w-2xl rounded-[30px] border border-orange-200 bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Archivos rechazados</p>
                                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">Estos archivos no se cargaron a la carpeta final</h3>
                                    </div>
                                    <button
                                        onClick={() => patchUploadStore({ showRejectedModal: false })}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {rejectedResults.map((result, index) => (
                                        <div key={`${result.filename}-global-rejected-${index}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                                            <p className="text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                                            <p className="mt-1 text-[12px] leading-relaxed text-orange-700">
                                                {result.analysis_data?.motivo_rechazo ?? result.resumen ?? result.alerts?.[0]?.msg ?? 'El archivo no corresponde al tipo esperado para esta carpeta.'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="fixed bottom-5 right-5 z-[70] w-full max-w-sm rounded-[24px] border border-[#D9D6FF] bg-white/95 shadow-[0_28px_80px_rgba(83,64,255,0.22)] backdrop-blur-xl overflow-hidden">
                        <div className="px-5 py-4 bg-[linear-gradient(135deg,#5340FF_0%,#7A5CFF_100%)] text-white">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/75">Carga de documentos</p>
                                    <h3 className="mt-1 text-[14px] font-extrabold leading-tight">
                                        {task.uploading ? 'Subiendo archivos...' : task.processing ? 'Analizando con IA...' : 'Disponible para revision'}
                                    </h3>
                                    <p className="mt-1 text-[11px] text-white/80">{task.category.name}</p>
                                </div>

                                {!task.uploading && (
                                    <button
                                        onClick={clearTask}
                                        className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 transition flex items-center justify-center text-white"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B5563] mb-2">
                                    <span>{task.uploading ? 'Procesando carga' : task.processing ? 'Consultando NotebookLM e IA' : 'Revision disponible'}</span>
                                    <span>{progressValue}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-[#ECEBFF] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,#5340FF_0%,#7C6CFF_100%)] transition-all duration-300"
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <SummaryMini label="Subidos" value={uploadedCount} tone="violet" />
                                <SummaryMini label="En curso" value={uploadingCount + waitingCount} tone="indigo" />
                                <SummaryMini label="Errores" value={errorCount} tone="red" />
                            </div>

                            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                {currentFileStates.map((fileState, index) => {
                                    const badge = PANEL_STATUS[
                                        fileState.resultStatus
                                        ?? fileState.pipelineStatus
                                        ?? (fileState.status === 'error' ? 'error' : 'pending')
                                    ] ?? PANEL_STATUS.pending;

                                    return (
                                        <div key={`${fileState.file.name}-${index}`} className="rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="min-w-0 truncate text-[12px] font-bold text-[#111827]">{fileState.file.name}</p>
                                                <span className="text-[10px] font-extrabold text-[#5340FF]">
                                                    {fileState.status === 'error' ? 'Error' : `${fileState.status === 'done' ? 100 : fileState.progress}%`}
                                                </span>
                                            </div>
                                            <div className="mt-2 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${fileState.status === 'error' ? 'bg-red-400' : 'bg-[#5340FF]'}`}
                                                    style={{ width: `${fileState.status === 'done' ? 100 : fileState.progress}%` }}
                                                />
                                            </div>
                                            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${badge.bg} ${badge.text}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                                {badge.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {!task.uploading && !task.processing && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: true })}
                                        className="h-10 rounded-xl bg-[linear-gradient(135deg,#5340FF_0%,#6D5BFF_50%,#8478FF_100%)] px-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-[0_18px_40px_rgba(83,64,255,0.28)] transition hover:scale-[1.01]"
                                    >
                                        Ver resumen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </DocumentUploadManagerContext.Provider>
    );

    if (typeof document === 'undefined') {
        return overlay;
    }

    return (
        <DocumentUploadManagerContext.Provider value={contextValue}>
            {children}
            {task ? createPortal(
                <>
                    {showCompletionNotice && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B0F19]/45 p-4 backdrop-blur-[4px]">
                            <div className="w-full max-w-3xl rounded-[30px] border border-[#E2E8F0] bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">Carga completada</p>
                                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">Los archivos terminaron su carga inicial</h3>
                                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                                            Aqui tienes el resumen final. Los archivos rechazados no fueron incorporados a la carpeta.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: false })}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <SummaryCard tone="green" value={acceptedResults.length} label="Aceptados" />
                                    <SummaryCard tone="yellow" value={reviewResults.length} label="Revision manual" />
                                    <SummaryCard tone="orange" value={rejectedCount} label="Rechazados" />
                                    <SummaryCard tone="red" value={errorCount} label="Errores" />
                                </div>

                                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                                    <SummaryList title="Documentos OK" tone="green" results={acceptedResults} emptyCopy="No hubo archivos aceptados en este lote." />
                                    <SummaryList title="Revisión manual" tone="yellow" results={reviewResults} emptyCopy="No hubo archivos en revisión manual." />
                                    <SummaryList title="Documentos rechazados" tone="orange" results={rejectedResults} emptyCopy="No hubo archivos rechazados." />
                                </div>

                                <div className="mt-5 flex justify-end gap-3">
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: false })}
                                        className="h-10 rounded-xl bg-[#F3F4F6] px-5 text-[11px] font-extrabold uppercase tracking-widest text-[#374151] transition hover:bg-[#E5E7EB]"
                                    >
                                        Cerrar aviso
                                    </button>
                                    <button
                                        onClick={clearTask}
                                        className="h-10 rounded-xl bg-[#059669] px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#047857]"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showRejectedModal && (
                        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0B0F19]/50 p-4 backdrop-blur-[4px]">
                            <div className="w-full max-w-2xl rounded-[30px] border border-orange-200 bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Archivos rechazados</p>
                                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">Estos archivos no se cargaron a la carpeta final</h3>
                                    </div>
                                    <button
                                        onClick={() => patchUploadStore({ showRejectedModal: false })}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {rejectedResults.map((result, index) => (
                                        <div key={`${result.filename}-global-rejected-${index}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                                            <p className="text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                                            <p className="mt-1 text-[12px] leading-relaxed text-orange-700">
                                                {result.analysis_data?.motivo_rechazo ?? result.resumen ?? result.alerts?.[0]?.msg ?? 'El archivo no corresponde al tipo esperado para esta carpeta.'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="fixed bottom-5 right-5 z-[70] w-full max-w-sm rounded-[24px] border border-[#D9D6FF] bg-white/95 shadow-[0_28px_80px_rgba(83,64,255,0.22)] backdrop-blur-xl overflow-hidden">
                        <div className="px-5 py-4 bg-[linear-gradient(135deg,#5340FF_0%,#7A5CFF_100%)] text-white">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/75">Carga de documentos</p>
                                    <h3 className="mt-1 text-[14px] font-extrabold leading-tight">
                                        {task.uploading ? 'Subiendo archivos...' : 'Carga finalizada'}
                                    </h3>
                                    <p className="mt-1 text-[11px] text-white/80">{task.category.name}</p>
                                </div>

                                {!task.uploading && (
                                    <button
                                        onClick={clearTask}
                                        className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 transition flex items-center justify-center text-white"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B5563] mb-2">
                                    <span>{task.uploading ? 'Procesando carga' : 'Carga completada'}</span>
                                    <span>{progressValue}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-[#ECEBFF] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,#5340FF_0%,#7C6CFF_100%)] transition-all duration-300"
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <SummaryMini label="Subidos" value={uploadedCount} tone="violet" />
                                <SummaryMini label="En curso" value={uploadingCount + waitingCount} tone="indigo" />
                                <SummaryMini label="Errores" value={errorCount} tone="red" />
                            </div>

                            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                {currentFileStates.map((fileState, index) => {
                                    const badge = PANEL_STATUS[fileState.resultStatus ?? (fileState.status === 'error' ? 'error' : 'pending')] ?? PANEL_STATUS.pending;

                                    return (
                                        <div key={`${fileState.file.name}-${index}`} className="rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="min-w-0 truncate text-[12px] font-bold text-[#111827]">{fileState.file.name}</p>
                                                <span className="text-[10px] font-extrabold text-[#5340FF]">
                                                    {fileState.status === 'error' ? 'Error' : `${fileState.status === 'done' ? 100 : fileState.progress}%`}
                                                </span>
                                            </div>
                                            <div className="mt-2 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${fileState.status === 'error' ? 'bg-red-400' : 'bg-[#5340FF]'}`}
                                                    style={{ width: `${fileState.status === 'done' ? 100 : fileState.progress}%` }}
                                                />
                                            </div>
                                            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${badge.bg} ${badge.text}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                                {badge.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {!task.uploading && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => patchUploadStore({ showCompletionNotice: true })}
                                        className="h-10 rounded-xl bg-[linear-gradient(135deg,#5340FF_0%,#6D5BFF_50%,#8478FF_100%)] px-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-[0_18px_40px_rgba(83,64,255,0.28)] transition hover:scale-[1.01]"
                                    >
                                        Ver resumen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            ) : null}
        </DocumentUploadManagerContext.Provider>
    );
}

export function useDocumentUploadManager() {
    const context = useContext(DocumentUploadManagerContext);

    if (!context) {
        throw new Error('useDocumentUploadManager must be used within DocumentUploadManagerProvider');
    }

    return context;
}

function SummaryMini({ label, value, tone }) {
    const toneClasses = {
        violet: 'bg-[#F5F3FF] text-[#312E81] text-[#7C3AED]',
        indigo: 'bg-[#EEF2FF] text-[#312E81] text-[#4F46E5]',
        red: 'bg-[#FEF2F2] text-[#991B1B] text-[#EF4444]',
    };

    const [backgroundClass, valueClass, labelClass] = toneClasses[tone].split(' ');

    return (
        <div className={`rounded-2xl px-3 py-2 ${backgroundClass}`}>
            <p className={`text-[9px] font-extrabold uppercase tracking-widest ${labelClass}`}>{label}</p>
            <p className={`mt-1 text-[18px] font-extrabold ${valueClass}`}>{value}</p>
        </div>
    );
}

function SummaryCard({ tone, value, label }) {
    const toneClasses = {
        green: 'border-green-200 bg-green-50 text-green-600 text-green-500',
        yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700 text-yellow-500',
        orange: 'border-orange-200 bg-orange-50 text-orange-600 text-orange-500',
        red: 'border-red-200 bg-red-50 text-red-600 text-red-500',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-600 text-indigo-500',
    };

    const [borderClass, backgroundClass, valueClass, labelClass] = toneClasses[tone].split(' ');

    return (
        <div className={`rounded-2xl border p-4 text-center ${borderClass} ${backgroundClass}`}>
            <p className={`text-[24px] font-extrabold ${valueClass}`}>{value}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>{label}</p>
        </div>
    );
}

function SummaryList({ title, tone, results, emptyCopy }) {
    const toneClasses = {
        green: {
            wrap: 'border-green-200 bg-green-50/70',
            title: 'text-green-700',
            item: 'border-green-200 text-green-700',
        },
        yellow: {
            wrap: 'border-yellow-200 bg-yellow-50/70',
            title: 'text-yellow-700',
            item: 'border-yellow-200 text-yellow-700',
        },
        orange: {
            wrap: 'border-orange-200 bg-orange-50/70',
            title: 'text-orange-700',
            item: 'border-orange-200 text-orange-700',
        },
    };

    const classes = toneClasses[tone];

    return (
        <div className={`rounded-[24px] border p-5 ${classes.wrap}`}>
            <p className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${classes.title}`}>{title}</p>
            <div className="mt-4 space-y-2">
                {results.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-3 py-3 text-[12px] text-[#64748B]">
                        {emptyCopy}
                    </div>
                )}

                {results.map((result, index) => (
                    <div key={`${result.filename}-${index}`} className={`rounded-2xl border bg-white px-3 py-2.5 ${classes.item}`}>
                        <p className="truncate text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                        <p className="mt-1 text-[11px]">
                            {result.analysis_data?.motivo_rechazo ?? result.resumen ?? result.alerts?.[0]?.msg ?? 'Archivo incorporado correctamente al flujo.'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
