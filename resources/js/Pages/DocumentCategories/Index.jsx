import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router, Link } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import { useConfirm } from '@/Components/ConfirmModal';
import { useDocumentUploadManager } from '@/Components/DocumentUploadManager';
import { useEffect, useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Ayudante para detectar carpetas de examen de forma robusta e ignorar acentos
const isExamenFolder = (name) => {
    if (!name) return false;
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('examen');
};

const isPipelineFolder = (name) => {
    if (!name) return false;
    const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized.includes('examen') || normalized.includes('contrato') || normalized.includes('anexo');
};

const PIPELINE_STATUS = {
    received: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Recibido', dot: 'bg-slate-400' },
    uploaded_to_notebook: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'En NotebookLM', dot: 'bg-blue-500' },
    indexing: { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Indexando', dot: 'bg-indigo-500 animate-pulse' },
    ready_for_query: { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Listo para IA', dot: 'bg-violet-500' },
    analyzed: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Analizado', dot: 'bg-amber-500' },
    stored_in_drive: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Respaldado', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-600', label: 'Falló', dot: 'bg-red-500' },
};

const PIPELINE_STATUS_COPY = {
    received: 'Documento recibido por Laravel.',
    uploaded_to_notebook: 'Documento cargado en NotebookLM.',
    indexing: 'NotebookLM está procesando el documento.',
    ready_for_query: 'Contexto listo para consulta con IA.',
    analyzed: 'Análisis completado. Falta confirmar respaldo final.',
    stored_in_drive: 'Documento analizado y respaldado en Google Drive.',
    failed: 'El pipeline falló. Puedes reintentar el procesamiento.',
};

const getResultDisplayStatus = (result) => {
    if (result?.duplicate) {
        return 'duplicate';
    }

    if (result?.pipeline_status === 'failed') {
        return 'error';
    }

    return result?.status ?? 'pending';
};

const resolveWorkerName = (analysisData) => {
    return analysisData?.trabajador
        ?? analysisData?.trabajador_nombre
        ?? analysisData?.worker_name
        ?? null;
};

const buildAlertsFromSnapshot = (snapshot, fallbackResult = {}) => {
    const analysisData = snapshot?.analysis_data ?? {};
    const pipelineError = snapshot?.pipeline_error ?? null;
    const analysisError = analysisData?.error ?? null;
    const status = snapshot?.analysis_status ?? fallbackResult?.status ?? 'pending';
    const pipelineStatus = snapshot?.pipeline_status ?? fallbackResult?.pipeline_status ?? null;

    if (pipelineError || analysisError) {
        return [{ type: 'error', msg: pipelineError ?? analysisError }];
    }

    if (status === 'rejected') {
        return [{ type: 'warning', msg: analysisData?.motivo_rechazo ?? 'El documento no corresponde al tipo esperado para esta carpeta.' }];
    }

    if (status === 'critical') {
        return [{ type: 'critical', msg: analysisData?.resumen ?? 'Se detectaron hallazgos críticos en el documento.' }];
    }

    if (status === 'alert') {
        return [{ type: 'alert', msg: analysisData?.resumen ?? 'El documento presenta observaciones.' }];
    }

    if (status === 'clean') {
        return [{ type: 'info', msg: analysisData?.resumen ?? 'Documento revisado sin observaciones.' }];
    }

    if (pipelineStatus && PIPELINE_STATUS_COPY[pipelineStatus]) {
        return [{ type: pipelineStatus === 'failed' ? 'error' : 'info', msg: PIPELINE_STATUS_COPY[pipelineStatus] }];
    }

    return fallbackResult?.alerts ?? [];
};

const hydrateBulkResult = (baseResult, snapshot) => {
    if (!snapshot) {
        return baseResult;
    }

    const analysisData = snapshot.analysis_data ?? {};
    const workerName = resolveWorkerName(analysisData);
    const alerts = buildAlertsFromSnapshot(snapshot, baseResult);

    return {
        ...baseResult,
        filename: baseResult.filename ?? snapshot.name ?? 'Documento',
        status: snapshot.analysis_status ?? baseResult.status ?? 'pending',
        pipeline_status: snapshot.pipeline_status ?? baseResult.pipeline_status ?? null,
        pipeline_error: snapshot.pipeline_error ?? null,
        worker_name: workerName,
        resumen: analysisData?.resumen ?? analysisData?.motivo_rechazo ?? baseResult.resumen ?? null,
        alerts,
    };
};

const shouldKeepPollingResult = (snapshot) => {
    const analysisStatus = snapshot?.analysis_status ?? null;
    const pipelineStatus = snapshot?.pipeline_status ?? null;

    if (analysisStatus && !['pending', 'error'].includes(analysisStatus)) {
        return false;
    }

    if (['ready_for_query', 'stored_in_drive', 'failed'].includes(pipelineStatus)) {
        return false;
    }

    return !analysisStatus || analysisStatus === 'pending' || ['received', 'uploaded_to_notebook', 'indexing', 'analyzed'].includes(pipelineStatus);
};

const getNotebookAvailabilityProgress = (result) => {
    const pipelineStatus = result?.pipeline_status ?? null;
    const status = result?.status ?? null;

    if (pipelineStatus === 'received') return 25;
    if (pipelineStatus === 'uploaded_to_notebook') return 70;
    if (pipelineStatus === 'indexing' || pipelineStatus === 'analyzed') return 90;
    if (['ready_for_query', 'stored_in_drive', 'failed'].includes(pipelineStatus)) return 100;

    if (['clean', 'alert', 'critical', 'rejected', 'duplicate', 'error'].includes(status)) {
        return 100;
    }

    return 10;
};

const shouldHideRejectedFromFolder = (categoryName, doc) => {
    return isPipelineFolder(categoryName) && doc?.analysis_status === 'rejected';
};

const getFolderDocuments = (category) => {
    const documents = Array.isArray(category?.documents) ? category.documents : [];

    return documents.filter((doc) => !shouldHideRejectedFromFolder(category?.name, doc));
};

const summarizeFolderDocuments = (category) => {
    const folderDocuments = getFolderDocuments(category);
    const summary = {
        folderDocuments,
        totalDocuments: folderDocuments.length,
        pendingDocuments: 0,
        alertDocuments: 0,
        criticalDocuments: 0,
        cleanDocuments: 0,
    };

    for (const document of folderDocuments) {
        if (!document.analysis_status || document.analysis_status === 'pending' || document.analysis_status === 'error' || hasPipelineInProgress(document)) {
            summary.pendingDocuments += 1;
        }

        if (document.analysis_status === 'alert') {
            summary.alertDocuments += 1;
        }

        if (document.analysis_status === 'critical') {
            summary.criticalDocuments += 1;
        }

        if (document.analysis_status === 'clean') {
            summary.cleanDocuments += 1;
        }
    }

    return summary;
};

function DonutProgress({ value, label, hint }) {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeValue / 100) * circumference;

    return (
        <div className="rounded-[28px] border border-[#E2E8F0] bg-[radial-gradient(circle_at_top,#f8fbff,white_65%)] p-6">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">{label}</p>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#5340FF] border border-[#E2E8F0]">
                    Lote
                </span>
            </div>

            <div className="mt-5 flex flex-col items-center text-center">
                <div className="relative h-40 w-40 shrink-0">
                    <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
                        <circle cx="60" cy="60" r={radius} stroke="#E2E8F0" strokeWidth="10" fill="none" />
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            stroke="#5340FF"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            fill="none"
                            className="transition-all duration-700 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[34px] font-black text-[#111827]">{safeValue}%</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#94A3B8]">avance</span>
                    </div>
                </div>

                <p className="mt-4 text-[24px] font-black text-[#0F172A]">
                    {safeValue === 100 ? 'Disponible en NotebookLM' : 'Procesando lote'}
                </p>
                <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[#64748B]">{hint}</p>
                {safeValue < 100 && (
                    <p className="mt-3 text-[11px] font-semibold text-[#94A3B8]">
                        El lote avanza en paralelo y la vista se actualiza sin esperar el cierre completo de cada archivo.
                    </p>
                )}
            </div>
        </div>
    );
}

const hasPipelineInProgress = (doc) => {
    return ['received', 'uploaded_to_notebook', 'indexing'].includes(doc.pipeline_status);
};

const humanizeStatus = (value) => {
    if (!value) return 'Sin definir';

    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatExamDate = (value) => {
    if (!value) return null;

    const [day, month, year] = value.split('/');
    if (!day || !month || !year) return value;

    return `${day}/${month}/${year}`;
};

const getToxicologyView = (drogas) => {
    const detected = Boolean(drogas?.detectado);
    const substances = Array.isArray(drogas?.sustancias) ? drogas.sustancias.filter(Boolean) : [];

    if (!detected && substances.length === 0) {
        return {
            tone: 'negative',
            badge: 'Negativo',
            title: 'Sin detección',
            detail: drogas?.detalle || 'No se detectaron alcohol ni drogas de abuso.',
        };
    }

    return {
        tone: 'positive',
        badge: 'Positivo',
        title: substances.length > 0 ? substances.join(', ') : 'Con detección',
        detail: drogas?.detalle || 'El examen reporta hallazgos toxicológicos que requieren revisión.',
    };
};

export default function Index({ project, categories }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '' });
    const [activeUploadCategoryId, setActiveUploadCategoryId] = useState(null);
    const activeUploadCategory = categories.find((category) => category.id === activeUploadCategoryId) ?? null;

    const onCreateCategory = (e) => {
        e.preventDefault();
        post(route('categories.store', project.id), { onSuccess: () => reset('name') });
    };

    useEffect(() => {
        if (activeUploadCategoryId && !activeUploadCategory) {
            setActiveUploadCategoryId(null);
        }
    }, [activeUploadCategoryId, activeUploadCategory]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Link
                                href={route('projects.index')}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-[#EAECF0] text-[#9CA3AF] hover:text-[#5340FF] hover:border-[#5340FF] transition shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-[22px] font-extrabold text-[#111827] uppercase tracking-wide leading-none">
                                    {project.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-11">
                            {project.code && (
                                <>
                                    <span className="bg-[#F3F4F6] text-[#6B7280] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest">
                                        {project.code}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                                </>
                            )}
                            <span className="bg-[#EEF2FF] text-[#5340FF] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest">
                                Google Drive
                            </span>
                        </div>
                    </div>
                    <div />
                </div>
            }
        >
            <Head title={`Carpetas — ${project.name}`} />

            <div className="max-w-6xl mx-auto space-y-6">

                {/* ── Create Folder ── */}
                <div className="bg-white rounded-[20px] border border-[#EAECF0] shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <svg className="w-4 h-4 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <h3 className="text-[11px] font-extrabold text-[#374151] uppercase tracking-[0.1em]">Nueva Carpeta</h3>
                    </div>
                    <form onSubmit={onCreateCategory} className="flex gap-3 items-start">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => setData('name', e.target.value)}
                                placeholder="Nombre de la carpeta…"
                                required
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/30 focus:border-[#5340FF] transition"
                            />
                            {errors.name && <p className="mt-1.5 text-[11px] text-red-500">{errors.name}</p>}
                        </div>
                        <button
                            disabled={processing}
                            className="h-[46px] px-6 bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-emerald-200 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            Agregar
                        </button>
                    </form>
                </div>

                {/* ── Categories List ── */}
                <div className="bg-white rounded-[20px] border border-[#EAECF0] shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-[#FAFAFA] border-b border-[#EAECF0]">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <span className="text-[11px] font-extrabold text-[#374151] uppercase tracking-[0.1em]">
                                Carpetas Registradas
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                {categories.length} Ítems
                            </span>
                        </div>
                    </div>

                    <div className="divide-y divide-[#F3F4F6]">
                        {categories.length === 0 && (
                            <div className="py-16 text-center">
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                    Sin carpetas en este proyecto
                                </p>
                            </div>
                        )}

                        {categories.map((category, idx) => (
                            <CategoryRow
                                key={category.id}
                                category={category}
                                index={idx}
                                onOpenUploadModal={setActiveUploadCategoryId}
                            />
                        ))}
                    </div>
                </div>
            </div>
            {activeUploadCategory && (
                <UploadDocumentModal
                    category={activeUploadCategory}
                    onClose={() => setActiveUploadCategoryId(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}

/** 
 * Botón para realizar análisis masivo en una carpeta específica.
 * Aparece solo si la carpeta contiene la palabra 'examen' (con o sin acento)
 * y existen documentos pendientes o con error.
 */
function BulkAnalyzeButton({ category }) {
    const [analyzing, setAnalyzing] = useState(false);
    const [queuedCount, setQueuedCount] = useState(0);
    const { folderDocuments } = summarizeFolderDocuments(category);

    const runBulkAnalysis = async () => {
        const toAnalyze = folderDocuments.filter(d =>
            !d.analysis_status || d.analysis_status === 'pending' || d.analysis_status === 'error' || d.pipeline_status === 'failed'
        );

        if (toAnalyze.length === 0) return;

        setAnalyzing(true);
        setQueuedCount(0);

        try {
            const response = await axios.post(route('documents.bulk-analyze', category.id));
            setQueuedCount(response.data?.queued ?? toAnalyze.length);
        } catch (error) {
            console.error("Bulk analysis queue error", error);
        } finally {
            setAnalyzing(false);
        }
    };

    // Verificamos si la categoría es de examen de manera robusta
    if (!isExamenFolder(category.name)) return null;

    // Verificamos si hay archivos que requieran acción
    const hasPending = folderDocuments.some(d =>
        !d.analysis_status || d.analysis_status === 'pending' || d.analysis_status === 'error' || d.pipeline_status === 'failed'
    );

    if (!hasPending && !analyzing) return null;

    return (
        <button
            onClick={runBulkAnalysis}
            disabled={analyzing}
            className={`h-11 px-5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition flex items-center gap-2 shadow-sm whitespace-nowrap
                ${analyzing
                    ? 'bg-amber-100 text-amber-600 border border-amber-200 cursor-wait'
                    : 'bg-[#FFB800] hover:bg-[#F2AE00] text-white shadow-amber-100 ring-4 ring-[#FFB800]/10'}`}
        >
            {analyzing ? (
                <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    ENCOLANDO...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {queuedCount > 0 ? `Encolados (${queuedCount})` : 'Análisis Masivo'}
                </>
            )}
        </button>
    );
}

function CategoryRow({ category, index, onOpenUploadModal }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [saving, setSaving] = useState(false);
    const [open, setOpen] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();
    const {
        folderDocuments,
        totalDocuments,
        pendingDocuments,
        alertDocuments,
        criticalDocuments,
        cleanDocuments,
    } = summarizeFolderDocuments(category);
    const allSelected = folderDocuments.length > 0 && selectedDocumentIds.length === folderDocuments.length;
    const hasSelection = selectedDocumentIds.length > 0;
    const folderDocumentIdsKey = folderDocuments.map((doc) => doc.id).join(',');

    useEffect(() => {
        setSelectedDocumentIds((prev) => {
            const next = prev.filter((id) => folderDocuments.some((doc) => doc.id === id));

            if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
                return prev;
            }

            return next;
        });
    }, [folderDocumentIdsKey]);

    const saveRename = () => {
        if (!name.trim() || name === category.name) { setEditing(false); return; }
        setSaving(true);
        router.patch(route('categories.update', category.id), { name }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); setEditing(false); },
            onError: () => { setSaving(false); },
        });
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') { setName(category.name); setEditing(false); }
    };

    const handleDeleteCategory = () => askConfirm({
        title: '¿Eliminar carpeta?',
        message: `Se eliminará la carpeta "${category.name}" junto con todos sus archivos y datos asociados. Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar carpeta',
        variant: 'danger',
        onConfirm: () => router.delete(route('categories.destroy', category.id), {
            preserveScroll: true,
        }),
    });

    const toggleDocumentSelection = (documentId) => {
        setSelectedDocumentIds((prev) => (
            prev.includes(documentId)
                ? prev.filter((id) => id !== documentId)
                : [...prev, documentId]
        ));
    };

    const toggleSelectAllDocuments = () => {
        setSelectedDocumentIds((prev) => (
            prev.length === folderDocuments.length ? [] : folderDocuments.map((doc) => doc.id)
        ));
    };

    const handleBulkDeleteDocuments = () => askConfirm({
        title: hasSelection && selectedDocumentIds.length === folderDocuments.length
            ? '¿Eliminar todos los archivos?'
            : '¿Eliminar archivos seleccionados?',
        message: hasSelection && selectedDocumentIds.length === folderDocuments.length
            ? `Se eliminarán los ${selectedDocumentIds.length} archivos de esta carpeta. Esta acción no se puede deshacer.`
            : `Se eliminarán ${selectedDocumentIds.length} archivo(s) seleccionados. Esta acción no se puede deshacer.`,
        confirmLabel: hasSelection && selectedDocumentIds.length === folderDocuments.length ? 'Eliminar todo' : 'Eliminar seleccionados',
        variant: 'danger',
        onConfirm: async () => {
            setBulkDeleting(true);

            try {
                await axios.delete(route('documents.bulk-destroy', category.id), {
                    data: { document_ids: selectedDocumentIds },
                    headers: { Accept: 'application/json' },
                });

                setSelectedDocumentIds([]);
                router.reload({
                    only: ['categories'],
                    preserveScroll: true,
                });
            } catch (error) {
                console.error('Bulk document delete error', error);
            } finally {
                setBulkDeleting(false);
            }
        },
    });

    return (
        <>
        <div className={`px-6 py-5 transition-colors ${open ? 'bg-[#FCFCFF]' : 'bg-white'}`}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Número + toggle acordeón */}
                    <button
                        onClick={() => setOpen(o => !o)}
                        className="w-11 h-11 rounded-2xl bg-[#5340FF] flex items-center justify-center text-white text-[13px] font-extrabold shrink-0 shadow-md shadow-indigo-200 relative group/num"
                        title={open ? 'Colapsar documentos' : 'Ver documentos'}
                    >
                        <span className="group-hover/num:opacity-0 transition-opacity">{String(index + 1).padStart(2, '0')}</span>
                        <svg className="w-4 h-4 absolute opacity-0 group-hover/num:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                        </svg>
                    </button>

                    <div className="min-w-0 flex-1">
                        {editing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#5340FF] bg-white text-[14px] font-extrabold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/30 transition min-w-0"
                                />
                                <button
                                    onClick={saveRename}
                                    disabled={saving}
                                    className="h-8 px-3 bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                    Guardar
                                </button>
                                <button
                                    onClick={() => { setName(category.name); setEditing(false); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group/name">
                                <p className="text-[15px] font-extrabold text-[#111827] truncate">{category.name}</p>
                                {isExamenFolder(category.name) && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7E6] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[#D97706]">
                                        Examen
                                    </span>
                                )}
                                <button
                                    onClick={handleDeleteCategory}
                                    title="Eliminar carpeta"
                                    className="opacity-0 group-hover/name:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 transition-all"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setEditing(true)}
                                    title="Renombrar carpeta"
                                    className="opacity-0 group-hover/name:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#EEF2FF] hover:text-[#5340FF] transition-all"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                            </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setOpen(o => !o)}
                                className="inline-flex items-center gap-1 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest transition cursor-pointer"
                            >
                                {totalDocuments} Items
                                <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {cleanDocuments > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-green-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    {cleanDocuments} OK
                                </span>
                            )}
                            {alertDocuments > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-amber-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    {alertDocuments} Alerta
                                </span>
                            )}
                            {criticalDocuments > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-red-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    {criticalDocuments} Critico
                                </span>
                            )}
                            {pendingDocuments > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    {pendingDocuments} Pendiente
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowBulkUpload(true)}
                        className="h-11 px-4 rounded-xl bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4330E0] text-[10px] font-extrabold uppercase tracking-widest transition flex items-center gap-2 whitespace-nowrap"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Carga Masiva
                    </button>
                    <BulkAnalyzeButton category={category} />
                    <UploadDocumentTrigger onClick={() => onOpenUploadModal(category.id)} />
                </div>
                </div>

                {open && totalDocuments > 0 && (
                    <div className="ml-[60px] rounded-[24px] border border-[#E9EAF8] bg-white px-4 py-4 shadow-sm shadow-indigo-50/40">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3">
                            <div className="flex items-center gap-3">
                                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6B7280]">
                                    Documentos de la carpeta
                                </p>
                                <label className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#475569]">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAllDocuments}
                                        className="h-4 w-4 rounded border-[#CBD5E1] text-[#5340FF] focus:ring-[#5340FF]"
                                    />
                                    Seleccionar todo
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                {hasSelection && (
                                    <button
                                        onClick={handleBulkDeleteDocuments}
                                        disabled={bulkDeleting}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                        </svg>
                                        {bulkDeleting ? 'Eliminando...' : hasSelection && selectedDocumentIds.length === totalDocuments ? 'Eliminar todo' : `Eliminar (${selectedDocumentIds.length})`}
                                    </button>
                                )}
                                <span className="text-[11px] font-semibold text-[#9CA3AF]">
                                    {totalDocuments} archivo{totalDocuments !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {folderDocuments.map(doc => (
                                <DocumentRow
                                    key={doc.id}
                                    doc={doc}
                                    category={category}
                                    selected={selectedDocumentIds.includes(doc.id)}
                                    onToggleSelected={() => toggleDocumentSelection(doc.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mensaje cuando está abierto pero vacío */}
            {open && folderDocuments.length === 0 && (
                <div className="mt-1 ml-[60px] rounded-[24px] border border-dashed border-[#E5E7EB] bg-[#FCFCFD] py-6 text-center">
                    <p className="text-[11px] text-[#9CA3AF] font-semibold">Sin documentos en esta carpeta</p>
                </div>
            )}

            {showBulkUpload && (
                <BulkUploadModal
                    project={category.project_id ? { id: category.project_id } : null}
                    category={category}
                    onClose={() => setShowBulkUpload(false)}
                />
            )}
        </div>
        {confirmModal}
        </>
    );
}


function UploadDocumentTrigger({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="h-9 px-4 flex items-center gap-1.5 bg-[#EEF2FF] hover:bg-indigo-100 text-[#5340FF] text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition whitespace-nowrap"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar PDF
        </button>
    );
}

function UploadDocumentModal({ category, onClose }) {
    const [fileStates, setFileStates] = useState([]); // { file, progress, status, error, resultStatus, resultSummary, resultReason, resultAlerts }
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [showCompletionNotice, setShowCompletionNotice] = useState(false);
    const [showRejectedModal, setShowRejectedModal] = useState(false);
    const [managerError, setManagerError] = useState(null);
    const inputRef = useRef(null);
    const { startDocumentUpload, hasActiveUpload } = useDocumentUploadManager();

    const getCsrf = () => {
        const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    };

    const addFiles = (selected) => {
        const pdfs = Array.from(selected).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (!pdfs.length) return;
        setManagerError(null);
        setFileStates(prev => [
            ...prev,
            ...pdfs.map(file => ({ file, progress: 0, status: 'waiting', error: null, resultStatus: null, resultSummary: null, resultReason: null, resultAlerts: [] })),
        ]);
    };

    const onFilesChange = (e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; };
    const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
    const onDrop = (e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

    const removeFile = (idx) => setFileStates(prev => prev.filter((_, i) => i !== idx));

    const startUpload = async () => {
        const selectedFiles = fileStates
            .filter((fileState) => fileState.status === 'waiting')
            .map((fileState) => fileState.file);

        if (selectedFiles.length === 0) {
            setManagerError('Selecciona al menos un PDF para iniciar la carga.');
            return;
        }

        const started = startDocumentUpload({ category, files: selectedFiles });

        if (!started) {
            setManagerError(hasActiveUpload
                ? 'Ya existe una carga activa. Espera a que termine o revisa el panel flotante.'
                : 'No fue posible iniciar la carga en segundo plano.');
            return;
        }

        handleClose();
    };

    const hasPending = fileStates.some(f => f.status === 'waiting');
    const allDone = fileStates.length > 0 && fileStates.every(f => f.status === 'done' || f.status === 'error');
    const uploadedCount = fileStates.filter((f) => f.status === 'done').length;
    const errorCount = fileStates.filter((f) => f.status === 'error').length;
    const waitingCount = fileStates.filter((f) => f.status === 'waiting').length;
    const uploadingCount = fileStates.filter((f) => f.status === 'uploading').length;
    const rejectedCount = fileStates.filter((f) => f.resultStatus === 'rejected').length;
    const progressValue = fileStates.length
        ? Math.round(fileStates.reduce((sum, file) => sum + (file.status === 'done' ? 100 : file.progress), 0) / fileStates.length)
        : 0;
    const acceptedResults = fileStates
        .filter((item) => item.status === 'done' && !['rejected', 'review'].includes(item.resultStatus))
        .map((item) => ({
            filename: item.file.name,
            resumen: item.resultSummary,
            alerts: item.resultAlerts,
        }));
    const reviewResults = fileStates
        .filter((item) => item.resultStatus === 'review')
        .map((item) => ({
            filename: item.file.name,
            resumen: item.resultSummary,
            alerts: item.resultAlerts,
            analysis_data: { motivo_rechazo: item.resultReason },
        }));
    const rejectedResults = fileStates
        .filter((item) => item.resultStatus === 'rejected')
        .map((item) => ({
            filename: item.file.name,
            resumen: item.resultSummary,
            alerts: item.resultAlerts,
            analysis_data: { motivo_rechazo: item.resultReason },
        }));

    const handleClose = () => {
        if (uploading) return;
        setFileStates([]);
        setDragging(false);
        setUploading(false);
        setMinimized(false);
        setShowCompletionNotice(false);
        setShowRejectedModal(false);
        setManagerError(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }

        onClose();
    };

    useEffect(() => {
        setFileStates([]);
        setDragging(false);
        setUploading(false);
        setMinimized(false);
        setShowCompletionNotice(false);
        setShowRejectedModal(false);
        setManagerError(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, [category.id]);

    useEffect(() => {
        if (allDone && rejectedCount > 0) {
            setShowRejectedModal(true);
        }
    }, [allDone, rejectedCount]);

    const refreshCategory = () => {
        router.reload({
            only: ['categories'],
            preserveScroll: true,
            onSuccess: () => {
                setShowCompletionNotice(false);
                setShowRejectedModal(false);
                onClose();
            },
        });
    };

    const rejectedReviewModal = showRejectedModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B0F19]/50 p-4 backdrop-blur-[4px]">
            <div className="w-full max-w-2xl rounded-[30px] border border-orange-200 bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
                            Archivos rechazados
                        </p>
                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">
                            Estos archivos no se cargaron a la carpeta final
                        </h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            Fueron descartados antes del alta final porque no corresponden al tipo documental esperado.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowRejectedModal(false)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-5 space-y-3">
                    {rejectedResults.map((result, index) => (
                        <div key={`${result.filename}-single-rejected-review-${index}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                            <p className="text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-orange-700">
                                {result.analysis_data?.motivo_rechazo
                                    ?? result.resumen
                                    ?? result.alerts?.[0]?.msg
                                    ?? 'El archivo no corresponde al tipo esperado para esta carpeta.'}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={() => setShowRejectedModal(false)}
                        className="h-10 rounded-xl bg-orange-500 px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-orange-600"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const completionModal = showCompletionNotice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F19]/45 p-4 backdrop-blur-[4px]">
            <div className="w-full max-w-3xl rounded-[30px] border border-[#E2E8F0] bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">
                            Carga completada
                        </p>
                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">
                            Los archivos terminaron su carga inicial
                        </h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            Aqui tienes el resumen final. Los archivos rechazados no fueron incorporados a la carpeta.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCompletionNotice(false)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-green-600">{acceptedResults.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Aceptados</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-orange-600">{rejectedCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Rechazados</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-red-600">{errorCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Errores</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-indigo-600">{fileStates.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Total</p>
                    </div>
                </div>

                <div className="mt-5">
                    <AnalysisSummaryPanel
                        acceptedResults={acceptedResults}
                        reviewResults={reviewResults}
                        rejectedResults={rejectedResults}
                        pipelineMode={isPipelineFolder(category?.name)}
                    />
                </div>

                <div className="mt-5 flex justify-end gap-3">
                    <button
                        onClick={() => setShowCompletionNotice(false)}
                        className="h-10 rounded-xl bg-[#F3F4F6] px-5 text-[11px] font-extrabold uppercase tracking-widest text-[#374151] transition hover:bg-[#E5E7EB]"
                    >
                        Cerrar aviso
                    </button>
                    <button
                        onClick={refreshCategory}
                        className="h-10 rounded-xl bg-[#059669] px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#047857]"
                    >
                        Ver carpeta
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (minimized) {
        return (
            <>
                {completionModal}
                {rejectedReviewModal}
                <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-[24px] border border-[#D9D6FF] bg-white/95 shadow-[0_28px_80px_rgba(83,64,255,0.22)] backdrop-blur-xl overflow-hidden">
                    <div className="px-5 py-4 bg-[linear-gradient(135deg,#5340FF_0%,#7A5CFF_100%)] text-white">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/75">
                                    Carga de documentos
                                </p>
                                <h3 className="mt-1 text-[14px] font-extrabold leading-tight">
                                    {uploading ? 'Subiendo archivos...' : allDone ? 'Carga finalizada' : 'Carga en pausa'}
                                </h3>
                                <p className="mt-1 text-[11px] text-white/80">
                                    {category.name}
                                </p>
                            </div>

                            {!uploading && (
                                <button
                                    onClick={handleClose}
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
                                <span>
                                    {uploading ? 'Procesando carga' : allDone ? 'Carga completada' : 'Lista para continuar'}
                                </span>
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
                            <div className="rounded-2xl bg-[#F5F3FF] px-3 py-2">
                                <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#7C3AED]">Subidos</p>
                                <p className="mt-1 text-[18px] font-extrabold text-[#312E81]">{uploadedCount}</p>
                            </div>
                            <div className="rounded-2xl bg-[#EEF2FF] px-3 py-2">
                                <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#4F46E5]">En curso</p>
                                <p className="mt-1 text-[18px] font-extrabold text-[#312E81]">{uploadingCount + waitingCount}</p>
                            </div>
                            <div className="rounded-2xl bg-[#FEF2F2] px-3 py-2">
                                <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#EF4444]">Errores</p>
                                <p className="mt-1 text-[18px] font-extrabold text-[#991B1B]">{errorCount}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMinimized(false)}
                                className="flex-1 h-11 rounded-2xl bg-[linear-gradient(135deg,#5340FF_0%,#6D5BFF_50%,#8478FF_100%)] text-white text-[11px] font-extrabold uppercase tracking-[0.22em] shadow-[0_18px_40px_rgba(83,64,255,0.28)] hover:scale-[1.01] transition"
                            >
                                Reabrir carga
                            </button>
                            {!uploading && (
                                <button
                                    onClick={handleClose}
                                    className="h-11 px-4 rounded-2xl border border-[#E5E7EB] bg-white text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#374151] transition"
                                >
                                    Cerrar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {completionModal}
            {rejectedReviewModal}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && handleClose()}
            >
                <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-[#EAECF0]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
                    <div>
                        <h2 className="text-[13px] font-extrabold text-[#111827] uppercase tracking-widest">Subir PDFs</h2>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{category.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {fileStates.length > 0 && (
                            <button
                                onClick={() => setMinimized(true)}
                                className="h-10 px-4 rounded-2xl bg-[linear-gradient(135deg,#F5F3FF_0%,#EEF2FF_100%)] border border-[#D9D6FF] text-[#4C1D95] text-[10px] font-extrabold uppercase tracking-[0.22em] shadow-[0_10px_24px_rgba(83,64,255,0.14)] hover:shadow-[0_16px_34px_rgba(83,64,255,0.18)] hover:-translate-y-0.5 transition flex items-center gap-2"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 14h16M4 18h10M8 10l4-4 4 4" />
                                </svg>
                                <span>Seguir trabajando</span>
                            </button>
                        )}
                        {!uploading && (
                            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`flex flex-col items-center justify-center gap-4 py-10 rounded-2xl border-2 border-dashed transition-all ${dragging ? 'border-[#5340FF] bg-[#EEF2FF] scale-[1.01]' : 'border-[#D1D5DB] bg-[#FAFAFA] hover:border-[#5340FF] hover:bg-[#F5F5FF]'}`}
                    >
                        <svg width="60" height="50" viewBox="0 0 60 50" fill="none" className={`transition-transform ${dragging ? 'scale-110' : ''}`}>
                            <ellipse cx="30" cy="44" rx="22" ry="4" fill="#E0E7FF" />
                            <path d="M16 34C11 34 7 30 7 25c0-4.2 2.8-7.7 6.7-8.8A15 15 0 0130 7a15 15 0 0114.8 19.5H46c3.6 0 6.5 2.9 6.5 6.5S49.6 39.5 46 39.5H16z" fill="url(#cg)" />
                            <path d="M30 22v14M24 28l6-6 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <defs>
                                <linearGradient id="cg" x1="7" y1="7" x2="52" y2="44" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#818CF8" />
                                    <stop offset="1" stopColor="#5340FF" />
                                </linearGradient>
                            </defs>
                        </svg>

                        <div className="text-center">
                            <p className="text-[13px] font-bold text-[#374151]">
                                {dragging ? 'Suelta los archivos aquí' : 'Arrastra y suelta tus PDFs aquí'}
                            </p>
                            {!dragging && <p className="text-[12px] font-bold text-[#9CA3AF] mt-1">O</p>}
                        </div>

                        {!dragging && (
                            <button
                                onClick={() => inputRef.current?.click()}
                                className="h-9 px-6 bg-[#5340FF] hover:bg-[#4330E0] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-md shadow-indigo-200"
                            >
                                Seleccionar Archivos
                            </button>
                        )}

                        <input ref={inputRef} type="file" accept=".pdf" multiple onChange={onFilesChange} className="hidden" />
                    </div>

                    {managerError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-[11px] font-bold text-red-600">{managerError}</p>
                        </div>
                    )}

                    {fileStates.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest">Archivos seleccionados</p>
                            {fileStates.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl px-4 py-3">
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                                        {item.status === 'waiting' && <div className="w-7 h-7 rounded-full border-2 border-[#D1D5DB]" />}
                                        {item.status === 'uploading' && (
                                            <svg className="w-7 h-7 text-[#5340FF] animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                        )}
                                        {item.status === 'done' && (
                                            <div className="w-7 h-7 rounded-full bg-[#5340FF] flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                        {item.status === 'error' && (
                                            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[12px] font-semibold text-[#374151] truncate max-w-[170px]">{item.file.name}</span>
                                            <span className="text-[11px] font-bold text-[#5340FF] ml-2 shrink-0">
                                                {item.status === 'error' ? 'Error' : `${item.status === 'done' ? 100 : item.progress}%`}
                                            </span>
                                        </div>
                                        {item.resultStatus && (
                                            <div className="mb-1.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${STATUS[item.resultStatus]?.bg ?? 'bg-slate-100'} ${STATUS[item.resultStatus]?.text ?? 'text-slate-600'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS[item.resultStatus]?.dot ?? 'bg-slate-400'}`}></span>
                                                    {STATUS[item.resultStatus]?.label ?? 'Guardado'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-400' : 'bg-[#5340FF]'}`}
                                                style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                                            />
                                        </div>
                                        {item.error && (
                                            <p className="mt-1.5 text-[10px] font-medium text-red-500">{item.error}</p>
                                        )}
                                    </div>

                                    {!uploading && item.status !== 'uploading' && (
                                        <button onClick={() => removeFile(idx)} className="shrink-0 w-6 h-6 flex items-center justify-center text-[#D1D5DB] hover:text-[#6B7280] transition">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {fileStates.length > 0 && (
                    <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3">
                        {allDone ? (
                            <>
                                <span className="text-[11px] font-bold text-green-600">
                                    {uploadedCount} archivo{uploadedCount !== 1 ? 's' : ''} subido{uploadedCount !== 1 ? 's' : ''}
                                </span>
                                <button onClick={() => setShowCompletionNotice(true)} className="h-9 px-6 bg-[#5340FF] hover:bg-[#4330E0] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition">
                                    Ver resumen
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="text-[11px] text-[#9CA3AF]">
                                    {fileStates.filter((f) => f.status === 'waiting').length} pendiente{fileStates.filter((f) => f.status === 'waiting').length !== 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={startUpload}
                                    disabled={uploading || !hasPending}
                                    className="h-9 px-6 bg-[#5340FF] hover:bg-[#4330E0] disabled:opacity-50 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition flex items-center gap-2"
                                >
                                    {uploading && (
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                    )}
                                    {uploading ? 'Subiendo…' : 'Subir todo'}
                                </button>
                            </>
                        )}
                    </div>
                )}
                </div>
            </div>
        </>
    );
}


/* ─── Mapa de estilos por estado ─── */

const STATUS = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Pendiente', dot: 'bg-gray-400' },
    clean: { bg: 'bg-green-50', text: 'text-green-600', label: 'Sin alertas', dot: 'bg-green-500' },
    alert: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Alerta', dot: 'bg-amber-500' },
    critical: { bg: 'bg-red-50', text: 'text-red-600', label: 'Crítico', dot: 'bg-red-500' },
    review: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Revisión manual', dot: 'bg-yellow-500' },
    error: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Error', dot: 'bg-gray-400' },
    rejected: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'No es examen', dot: 'bg-orange-400' },
    analyzing: { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Analizando...', dot: 'bg-indigo-400 animate-pulse' },
};

const DOCUMENT_STATUS_COPY = {
    clean: 'Documento revisado sin observaciones.',
    alert: 'Documento revisado con observaciones.',
    critical: 'Documento revisado con hallazgos criticos.',
    review: 'El filtro inicial no pudo confirmar el tipo documental. Requiere revisión manual.',
    rejected: 'El archivo no corresponde a un examen de salud.',
    error: 'No fue posible completar el analisis.',
    pending: 'Documento cargado pendiente de revision.',
};

function DocumentRow({ doc, category, selected = false, onToggleSelected }) {
    const [open, setOpen] = useState(false);
    const [analysisData, setAnalysisData] = useState(doc.analysis_data ?? null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [detailsError, setDetailsError] = useState(null);
    const { confirmModal, askConfirm } = useConfirm();

    // Automatic Mutation Management
    const { mutate: performAnalyze, isPending } = useMutation({
        mutationFn: async () => {
            return axios.post(route('documents.analyze', doc.id));
        },
        onSuccess: () => {}
    });

    const isInternalAnalyzing = doc.analysis_status === 'pending' && isPending;
    const pipelineBadge = !doc.analysis_status || doc.analysis_status === 'pending'
        ? (PIPELINE_STATUS[doc.pipeline_status] ?? null)
        : null;
    const st = isPending
        ? STATUS.analyzing
        : (pipelineBadge ?? (STATUS[doc.analysis_status] ?? STATUS.pending));
    const d = analysisData;
    const toxicologyView = getToxicologyView(d?.drogas);

    const analyze = () => performAnalyze();

    const toggleDetails = async () => {
        if (open) {
            setOpen(false);
            return;
        }

        setOpen(true);

        if (!doc.has_analysis_details || analysisData || isLoadingDetails) {
            return;
        }

        setIsLoadingDetails(true);
        setDetailsError(null);

        try {
            const response = await axios.get(route('documents.show', doc.id));
            setAnalysisData(response.data?.analysis_data ?? null);
        } catch (error) {
            setDetailsError('No se pudo cargar el detalle del análisis.');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleDelete = () => askConfirm({
        title: '¿Eliminar archivo?',
        message: `Se eliminará "${doc.name}" de Google Drive. Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        variant: 'danger',
        onConfirm: () => router.delete(route('documents.destroy', doc.id), {
            preserveScroll: true,
        }),
    });

    return (
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl overflow-hidden">
            {/* Row header */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <label className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white">
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelected}
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#5340FF] focus:ring-[#5340FF]"
                        />
                    </label>
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#374151] truncate">{doc.name}</p>
                        {isPipelineFolder(category.name) && (
                            <p className="text-[11px] text-[#9CA3AF] truncate">
                                {PIPELINE_STATUS_COPY[doc.pipeline_status] ?? DOCUMENT_STATUS_COPY[doc.analysis_status] ?? DOCUMENT_STATUS_COPY.pending}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Badge estado */}
                    {isPipelineFolder(category.name) && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                            {st.label}
                        </span>
                    )}

                    {/* Botón Analizar — solo si nunca fue analizado (pending/null) o si falló (error) */}
                    {isPipelineFolder(category.name) && (doc.pipeline_status === 'ready_for_query' || doc.pipeline_status === 'failed' || doc.analysis_status === 'error') && (
                        <button
                            onClick={analyze}
                            disabled={isPending}
                            title={doc.analysis_status === 'error' || doc.pipeline_status === 'failed' ? 'Re-intentar análisis' : 'Analizar documento'}
                            className={`h-8 px-3 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition disabled:opacity-50 whitespace-nowrap shadow-sm 
                                ${doc.analysis_status === 'error' || doc.pipeline_status === 'failed'
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100'
                                    : 'bg-[#5340FF] hover:bg-[#4330E0] text-white shadow-indigo-100'}`}
                        >
                            {isPending ? (
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            )}
                            {doc.analysis_status === 'error' || doc.pipeline_status === 'failed' ? 'Re-intentar' : 'Analizar'}
                        </button>
                    )}

                    {/* Toggle resultado */}
                    {doc.has_analysis_details && (
                        <button
                            onClick={toggleDetails}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-[#EAECF0] text-[#6B7280] hover:bg-[#F3F4F6] transition"
                        >
                            <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}

                    {/* Eliminar */}
                    <button
                        onClick={handleDelete}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {open && isLoadingDetails && (
                <div className="border-t border-[#EAECF0] bg-white px-5 py-4">
                    <p className="text-[12px] font-semibold text-[#6B7280]">Cargando detalle del análisis...</p>
                </div>
            )}

            {open && detailsError && (
                <div className="border-t border-red-200 bg-red-50 px-5 py-4">
                    <p className="text-[12px] font-semibold text-red-600">{detailsError}</p>
                </div>
            )}

            {/* Panel de Rechazo — documento no es examen de salud */}
            {open && d && d.es_examen_salud === false && (
                <div className="border-t border-orange-200 bg-orange-50 px-5 py-4 flex items-start gap-3">
                    <span className="text-lg shrink-0">⛔</span>
                    <div>
                        <p className="text-[12px] font-extrabold text-orange-700 uppercase tracking-wide mb-1">Documento no válido para examen de salud</p>
                        <p className="text-[12px] text-orange-600 leading-relaxed">{d.motivo_rechazo ?? 'El documento no corresponde a un examen médico ocupacional.'}</p>
                    </div>
                </div>
            )}

            {/* Panel de Análisis expandido */}
            {open && d && !d.error && d.es_examen_salud !== false && (
                <div className="border-t border-[#EAECF0] bg-white px-5 py-5 space-y-4">
                    {d.resumen && (
                        <p className="text-[13px] text-[#374151] leading-relaxed">{d.resumen}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">Trabajador</p>
                            <p className="mt-1 text-[13px] font-bold text-[#111827]">{d.trabajador ?? 'Sin dato'}</p>
                        </div>
                        <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">RUT</p>
                            <p className="mt-1 text-[13px] font-bold text-[#111827]">{d.trabajador_rut ?? 'Sin dato'}</p>
                        </div>
                        <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">Tipo de examen</p>
                            <p className="mt-1 text-[13px] font-bold text-[#111827]">{d.tipo_examen ?? 'Sin dato'}</p>
                        </div>
                        <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">Vigencia</p>
                            <p className="mt-1 text-[13px] font-bold text-[#111827]">{d.fecha_vencimiento ? formatExamDate(d.fecha_vencimiento) : 'Sin dato'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`rounded-[22px] p-4 border ${d.imc?.critico ? 'bg-red-50 border-red-200' : d.imc?.alerta ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">IMC</span>
                                {d.imc?.critico ? (
                                    <span className="text-[10px] font-extrabold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">Crítico</span>
                                ) : d.imc?.alerta ? (
                                    <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Alerta</span>
                                ) : (
                                    <span className="text-[10px] font-extrabold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">Normal</span>
                                )}
                            </div>
                            <p className="text-[22px] font-extrabold text-[#111827]">
                                {d.imc?.valor ?? '—'} <span className="text-[13px] font-semibold text-[#6B7280]">{d.imc?.categoria}</span>
                            </p>
                            <p className="mt-2 text-[11px] text-[#6B7280] leading-relaxed">{d.imc?.detalle}</p>
                        </div>

                        <div className={`rounded-[22px] p-4 border ${toxicologyView.tone === 'positive' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">Toxicología</span>
                                {toxicologyView.tone === 'positive' ? (
                                    <span className="text-[10px] font-extrabold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">{toxicologyView.badge}</span>
                                ) : (
                                    <span className="text-[10px] font-extrabold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">{toxicologyView.badge}</span>
                                )}
                            </div>
                            <p className="text-[13px] font-bold text-[#111827]">{toxicologyView.title}</p>
                            <p className="mt-2 text-[11px] text-[#6B7280] leading-relaxed">{toxicologyView.detail}</p>
                        </div>
                    </div>

                    {d.otros_hallazgos?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Otros Hallazgos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {d.otros_hallazgos.map((h, i) => (
                                    <div key={i} className={`rounded-[18px] p-3 border ${h.alerta ? 'bg-amber-50 border-amber-200' : 'bg-[#F9FAFB] border-[#EAECF0]'}`}>
                                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{h.titulo}</p>
                                        <p className={`mt-1 text-[13px] font-extrabold leading-relaxed ${h.alerta ? 'text-amber-600' : 'text-[#111827]'}`}>{h.valor}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {d.estado_general && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#F3F4F6]">
                            <span className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest">Aptitud:</span>
                            <span className={`text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full ${d.estado_general === 'apto' ? 'bg-green-50 text-green-600' :
                                d.estado_general === 'apto_con_restricciones' ? 'bg-amber-50 text-amber-600' :
                                    d.estado_general === 'no_apto' ? 'bg-red-50 text-red-600' :
                                        'bg-gray-100 text-gray-500'
                                }`}>
                                {humanizeStatus(d.estado_general)}
                            </span>
                            {d.fecha_examen && <span className="text-[11px] text-[#9CA3AF] ml-auto">{formatExamDate(d.fecha_examen)}</span>}
                        </div>
                    )}
                </div>
            )}

            {/* Error de análisis */}
            {open && d?.error && (
                <div className="border-t border-[#EAECF0] bg-red-50 px-5 py-4">
                    <p className="text-[12px] text-red-600 font-semibold">{d.error}</p>
                </div>
            )}

            {/* Modal confirmación eliminar */}
            {confirmModal}
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   BULK UPLOAD MODAL
   Sube cada PDF individualmente al backend, que:
     1. Lo recibe y lo prepara para NotebookLM
     2. NotebookLM procesa el documento
     3. Gemini consulta el contexto ya procesado
     4. Google Drive se usa como respaldo final
   El frontend muestra progreso en tiempo real.
══════════════════════════════════════════════════════ */
function BulkUploadModal({ project, category, onClose }) {
    const fileInputRef = useRef(null);
    const [phase, setPhase] = useState('select');  // 'select' | 'uploading' | 'done'
    const [minimized, setMinimized] = useState(false);
    const [files, setFiles] = useState([]);
    const [current, setCurrent] = useState(0);
    const [results, setResults] = useState([]);
    const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
    const [bulkAnalyzeQueued, setBulkAnalyzeQueued] = useState(false);
    const [backgroundAnalysisIds, setBackgroundAnalysisIds] = useState([]);
    const [showCompletionNotice, setShowCompletionNotice] = useState(false);
    const [showRejectedModal, setShowRejectedModal] = useState(false);
    const completedUploadsRef = useRef(0);
    const uploadBatchIdRef = useRef(null);

    const resetModalState = () => {
        setPhase('select');
        setMinimized(false);
        setFiles([]);
        setCurrent(0);
        setResults([]);
        setBulkAnalyzing(false);
        setBulkAnalyzeQueued(false);
        setBackgroundAnalysisIds([]);
        setShowCompletionNotice(false);
        setShowRejectedModal(false);
        completedUploadsRef.current = 0;
        uploadBatchIdRef.current = null;

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        resetModalState();
        onClose();
    };

    const refreshCategories = () => {
        resetModalState();
        router.reload({
            only: ['categories'],
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    useEffect(() => {
        resetModalState();
    }, [category.id]);

    const onFilesChange = (e) => {
        const selected = Array.from(e.target.files);
        setFiles(selected);
        setPhase('select');
        setResults([]);
        setBulkAnalyzeQueued(false);
        setBackgroundAnalysisIds([]);
        setShowCompletionNotice(false);
        setShowRejectedModal(false);
    };

    const getCsrfToken = () => {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    };

    const fetchDocumentSnapshot = async (documentId) => {
        const response = await axios.get(route('documents.show', documentId), {
            headers: { Accept: 'application/json' },
        });

        return response.data;
    };

    const refreshResultFromBackend = async (baseResult, { attempts = 6, delayMs = 1500 } = {}) => {
        if (!baseResult?.document_id) {
            return baseResult;
        }

        let latestResult = baseResult;

        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const snapshot = await fetchDocumentSnapshot(baseResult.document_id);
                latestResult = hydrateBulkResult(latestResult, snapshot);

                if (! shouldKeepPollingResult(snapshot)) {
                    return latestResult;
                }
            } catch (_) {
                return latestResult;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        return latestResult;
    };

    const updateResultAt = (index, updater) => {
        setResults(prev => prev.map((item, itemIndex) => {
            if (itemIndex !== index) {
                return item;
            }

            return typeof updater === 'function' ? updater(item) : updater;
        }));
    };

    const uploadFileAtIndex = async (file, index) => {
        updateResultAt(index, (item) => ({
            ...item,
            filename: file.name,
            alerts: [{ type: 'info', msg: 'Subiendo archivo al sistema...' }],
        }));

        const formData = new FormData();
        formData.append('file', file);
        if (uploadBatchIdRef.current) {
            formData.append('batch_id', uploadBatchIdRef.current);
        }

        try {
            const response = await axios.post(
                route('categories.bulk-upload', { project: project.id, category: category.id }),
                formData
            );

            const immediateResult = {
                ...response.data,
                filename: response.data?.filename ?? file.name,
            };

            updateResultAt(index, immediateResult);

            if (immediateResult?.document_id) {
                void refreshResultFromBackend(immediateResult, { attempts: 10, delayMs: 2000 })
                    .then((refreshed) => updateResultAt(index, refreshed))
                    .catch(() => null);
            }
        } catch (err) {
            const duplicatePayload = err.response?.status === 409 && err.response?.data?.duplicate
                ? err.response.data
                : null;

            if (duplicatePayload) {
                updateResultAt(index, {
                    ...duplicatePayload,
                    filename: duplicatePayload.filename ?? file.name,
                    status: 'duplicate',
                    resumen: duplicatePayload.resumen ?? 'La informacion de este archivo ya existe en el sistema.',
                    alerts: duplicatePayload.alerts ?? [{ type: 'warning', msg: 'Este archivo ya existe en el sistema.' }],
                });
            } else {
                console.error('File upload error:', err);
                updateResultAt(index, {
                    success: false,
                    filename: file.name,
                    worker_name: null,
                    status: 'error',
                    alerts: [{ type: 'error', msg: 'Error de subida: ' + (err.response?.data?.message || err.message) }],
                });
            }
        } finally {
            completedUploadsRef.current += 1;
            setCurrent(completedUploadsRef.current);
        }
    };

    const startUpload = async () => {
        if (files.length === 0) return;
        setPhase('uploading');
        const initialResults = files.map((file) => ({
            filename: file.name,
            status: 'pending',
            pipeline_status: null,
            worker_name: null,
            alerts: [{ type: 'info', msg: 'Esperando turno de carga.' }],
        }));
        setResults(initialResults);
        setCurrent(0);
        completedUploadsRef.current = 0;
        uploadBatchIdRef.current = globalThis.crypto?.randomUUID?.() ?? `batch-${Date.now()}`;

        const concurrency = Math.min(3, files.length);
        let nextIndex = 0;

        const workers = Array.from({ length: concurrency }, async () => {
            while (nextIndex < files.length) {
                const fileIndex = nextIndex++;
                await uploadFileAtIndex(files[fileIndex], fileIndex);
            }
        });

        await Promise.all(workers);

        setPhase('done');
    };

    const totalAlerts = results.filter(r => ['alert', 'critical'].includes(getResultDisplayStatus(r))).length;
    const totalCritical = results.filter(r => getResultDisplayStatus(r) === 'critical').length;
    const totalOk = results.filter(r => getResultDisplayStatus(r) === 'clean').length;
    const totalRejected = results.filter(r => getResultDisplayStatus(r) === 'rejected').length;
    const totalDuplicates = results.filter(r => getResultDisplayStatus(r) === 'duplicate').length;
    const totalErrors = results.filter(r => getResultDisplayStatus(r) === 'error').length;
    const totalProcessed = results.length;
    const usesNotebookPipeline = isPipelineFolder(category?.name);
    const acceptedResults = results.filter((result) => ['clean', 'alert', 'critical', 'duplicate'].includes(getResultDisplayStatus(result)));
    const reviewResults = results.filter((result) => getResultDisplayStatus(result) === 'review');
    const rejectedResults = results.filter((result) => getResultDisplayStatus(result) === 'rejected');
    const visibleResults = results.filter((result) => !['rejected', 'review'].includes(getResultDisplayStatus(result)));
    const averageNotebookProgress = results.length > 0
        ? results.reduce((carry, result) => carry + getNotebookAvailabilityProgress(result), 0) / results.length
        : 0;
    const analyzableResults = results.filter((result) => (
        result?.document_id
        && !result?.duplicate
        && (!usesNotebookPipeline || result?.pipeline_status === 'ready_for_query')
        && !['rejected', 'review', 'clean', 'alert', 'critical'].includes(result?.status)
    ));
    const canRunBulkAnalyze = phase === 'done' && analyzableResults.length > 0 && !bulkAnalyzing;
    const canMinimize = phase !== 'select';
    const compactProgressValue = phase === 'uploading'
        ? (files.length > 0 ? (current / files.length) * 100 : 0)
        : averageNotebookProgress;
    const compactTitle = phase === 'uploading'
        ? `Carga en curso · ${current}/${files.length}`
        : bulkAnalyzeQueued
            ? 'Analisis IA en segundo plano'
            : 'Resumen del lote listo';
    const compactCopy = phase === 'uploading'
        ? 'Puedes seguir trabajando mientras terminamos de recibir y preparar el lote.'
        : bulkAnalyzeQueued
            ? 'El lote sigue avanzando en segundo plano. Puedes revisar la carpeta cuando quieras.'
            : 'El resumen quedó disponible. Puedes reabrir este panel cuando lo necesites.';
    const showAiProcessingRibbon = bulkAnalyzing || bulkAnalyzeQueued;
    const showReadyForReviewRibbon = phase === 'done' && !showAiProcessingRibbon && visibleResults.length > 0;

    useEffect(() => {
        if (phase === 'done' && (rejectedResults.length > 0 || reviewResults.length > 0)) {
            setShowRejectedModal(true);
        }
    }, [phase, rejectedResults.length, reviewResults.length]);

    useEffect(() => {
        if (!bulkAnalyzeQueued || backgroundAnalysisIds.length === 0) {
            return;
        }

        const trackedResults = backgroundAnalysisIds
            .map((documentId) => results.find((result) => result.document_id === documentId))
            .filter(Boolean);

        if (trackedResults.length !== backgroundAnalysisIds.length) {
            return;
        }

        const allFinished = trackedResults.every((result) => (
            ['clean', 'alert', 'critical', 'rejected', 'error', 'duplicate'].includes(getResultDisplayStatus(result))
        ));

        if (!allFinished) {
            return;
        }

        setBulkAnalyzeQueued(false);
        setMinimized(false);
        setShowCompletionNotice(true);
    }, [backgroundAnalysisIds, bulkAnalyzeQueued, results]);

    const rejectedReviewModal = showRejectedModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B0F19]/50 p-4 backdrop-blur-[4px]">
            <div className="w-full max-w-2xl rounded-[30px] border border-orange-200 bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
                            Archivos rechazados
                        </p>
                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">
                            Estos archivos no se cargaron a la carpeta final
                        </h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            Fueron descartados antes del alta final porque no corresponden al tipo documental esperado.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowRejectedModal(false)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-5 space-y-3">
                    {rejectedResults.map((result, index) => (
                        <div key={`${result.filename}-rejected-review-${index}`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                            <p className="text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-orange-700">
                                {result.analysis_data?.motivo_rechazo
                                    ?? result.resumen
                                    ?? result.alerts?.[0]?.msg
                                    ?? 'El archivo no corresponde al tipo esperado para esta carpeta.'}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={() => setShowRejectedModal(false)}
                        className="h-10 rounded-xl bg-orange-500 px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-orange-600"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const triggerBulkAnalyze = async () => {
        if (analyzableResults.length === 0 || bulkAnalyzing) {
            return;
        }

        setBulkAnalyzing(true);

        const targetIds = analyzableResults.map((result) => result.document_id);

        setResults(prev => prev.map((item) => (
            targetIds.includes(item.document_id)
                ? {
                    ...item,
                    status: 'pending',
                    alerts: [{ type: 'info', msg: 'Analisis IA masivo encolado para este lote.' }],
                    resumen: 'El lote fue enviado a la etapa de analisis con IA.',
                }
                : item
        )));

        try {
            await axios.post(
                route('documents.bulk-analyze', category.id),
                { document_ids: targetIds },
                { headers: { Accept: 'application/json' } }
            );

            setBulkAnalyzeQueued(true);
            setBackgroundAnalysisIds(targetIds);
            setShowCompletionNotice(false);
            setShowRejectedModal(false);
            setMinimized(true);

            void Promise.all(targetIds.map(async (documentId) => {
                const baseResult = results.find((result) => result.document_id === documentId);
                if (!baseResult) {
                    return;
                }

                const refreshed = await refreshResultFromBackend(
                    {
                        ...baseResult,
                        status: 'pending',
                    },
                    { attempts: 12, delayMs: 2000 }
                );

                updateResultAt(
                    results.findIndex((result) => result.document_id === documentId),
                    refreshed,
                );
            }));
        } catch (err) {
            const message = err.response?.data?.message || err.message;

            setResults(prev => prev.map((item) => (
                targetIds.includes(item.document_id)
                    ? {
                        ...item,
                        status: 'error',
                        alerts: [{ type: 'error', msg: `Error al iniciar analisis masivo: ${message}` }],
                    }
                    : item
            )));
        } finally {
            setBulkAnalyzing(false);
        }
    };

    const completionModal = showCompletionNotice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F19]/45 p-4 backdrop-blur-[4px]">
            <div className="w-full max-w-3xl rounded-[30px] border border-[#E2E8F0] bg-white p-6 shadow-[0_32px_80px_-18px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">
                            Analisis completado
                        </p>
                        <h3 className="mt-1 text-[24px] font-black text-[#0F172A]">
                            El lote termino su procesamiento en segundo plano
                        </h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            Aqui tienes el resumen final. Los archivos rechazados no fueron incorporados a la carpeta de examen.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCompletionNotice(false)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-green-600">{totalOk}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">OK</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-amber-600">{Math.max(0, totalAlerts - totalCritical)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Alertas</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-red-600">{totalCritical}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Criticos</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-orange-600">{totalRejected}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Rechazados</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-center">
                        <p className="text-[24px] font-extrabold text-slate-600">{totalErrors}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Errores</p>
                    </div>
                </div>

                <div className="mt-5">
                    <AnalysisSummaryPanel
                        acceptedResults={acceptedResults}
                        reviewResults={reviewResults}
                        rejectedResults={rejectedResults}
                    />
                </div>

                <div className="mt-5 flex justify-end gap-3">
                    <button
                        onClick={() => setShowCompletionNotice(false)}
                        className="h-10 rounded-xl bg-[#F3F4F6] px-5 text-[11px] font-extrabold uppercase tracking-widest text-[#374151] transition hover:bg-[#E5E7EB]"
                    >
                        Cerrar aviso
                    </button>
                    <button
                        onClick={refreshCategories}
                        className="h-10 rounded-xl bg-[#059669] px-5 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#047857]"
                    >
                        Ver carpeta
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (minimized) {
        return (
            <>
                {completionModal}
                {rejectedReviewModal}
                <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-[28px] border border-[#E2E8F0] bg-white/95 p-5 shadow-[0_28px_60px_-18px_rgba(15,23,42,0.32)] backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B]">
                            {category.name}
                        </p>
                        <p className="mt-1 text-[18px] font-black text-[#0F172A]">{compactTitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMinimized(false)}
                            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#5340FF] transition hover:bg-[#EEF2FF]"
                        >
                            Reabrir
                        </button>
                        {phase !== 'uploading' && (
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] transition hover:bg-[#E5E7EB]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#F8FAFC] p-4">
                    {showAiProcessingRibbon && (
                        <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-600">Analizando IA</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-violet-700">
                                NotebookLM y la IA siguen procesando el lote. Los datos se cargarán en la carpeta cuando queden listos.
                            </p>
                        </div>
                    )}
                    {showReadyForReviewRibbon && (
                        <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">Disponible para revisión</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-emerald-700">
                                Los datos aceptados ya quedaron cargados en la carpeta y están listos para revisión.
                            </p>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold text-[#475569]">{compactCopy}</p>
                        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#5340FF] border border-[#E2E8F0]">
                            {Math.round(compactProgressValue)}%
                        </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                            className="h-full rounded-full bg-[#5340FF] transition-all duration-500"
                            style={{ width: `${Math.max(8, Math.min(100, compactProgressValue))}%` }}
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                    <div className="rounded-2xl bg-green-50 px-3 py-2 text-center">
                        <p className="text-[16px] font-black text-green-600">{totalOk}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-green-500">OK</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
                        <p className="text-[16px] font-black text-amber-600">{Math.max(0, totalAlerts - totalCritical)}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Alertas</p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-3 py-2 text-center">
                        <p className="text-[16px] font-black text-orange-600">{totalRejected}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-orange-500">Rech.</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-3 py-2 text-center">
                        <p className="text-[16px] font-black text-slate-600">{totalErrors}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Errores</p>
                    </div>
                </div>

                {phase === 'done' && (
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={refreshCategories}
                            className="flex-1 h-10 rounded-xl bg-[#059669] px-4 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#047857]"
                        >
                            Ver carpeta
                        </button>
                        {!bulkAnalyzeQueued && (
                            <button
                                onClick={triggerBulkAnalyze}
                                disabled={!canRunBulkAnalyze}
                                className="flex-1 h-10 rounded-xl bg-[#5340FF] px-4 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:bg-[#4330E0] disabled:opacity-50"
                            >
                                Analisis IA
                            </button>
                        )}
                    </div>
                )}
                </div>
            </>
        );
    }

    return (
        <>
            {completionModal}
            {rejectedReviewModal}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F19]/60 backdrop-blur-[6px] transition-all duration-300">
                <div className="bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-[#EAECF0] animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-[#F3F4F6] bg-[#FAFAFA] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#5340FF] flex items-center justify-center shadow-md shadow-indigo-200">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[15px] font-extrabold text-[#111827] uppercase tracking-wide">Carga Masiva · {category.name}</h2>
                            <p className="text-[11px] text-[#9CA3AF] font-medium mt-0.5">La carpeta sigue el tipo de documento seleccionado</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canMinimize && (
                            <button
                                onClick={() => setMinimized(true)}
                                className="group relative overflow-hidden rounded-2xl border border-[#C7D2FE] bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_45%,#ede9fe_100%)] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4330E0] shadow-[0_10px_24px_-12px_rgba(83,64,255,0.65)] transition hover:-translate-y-0.5 hover:border-[#A5B4FC] hover:shadow-[0_16px_30px_-14px_rgba(83,64,255,0.75)]"
                            >
                                <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_45%)] opacity-80 transition group-hover:opacity-100" />
                                <span className="relative flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/85 text-[#5340FF] shadow-sm">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </span>
                                    <span>Seguir trabajando</span>
                                </span>
                            </button>
                        )}
                        {phase !== 'uploading' && (
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

                    {/* Fase: Selección */}
                    {phase === 'select' && (
                        <div>
                            <label
                                htmlFor="bulk-files"
                                className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-[#D1D5DB] rounded-2xl cursor-pointer bg-[#FAFAFA] hover:bg-[#EEF2FF] hover:border-[#5340FF] transition group"
                            >
                                <svg className="w-10 h-10 text-[#D1D5DB] group-hover:text-[#5340FF] transition mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-[13px] font-bold text-[#6B7280] group-hover:text-[#5340FF] transition">
                                    {files.length > 0 ? `${files.length} archivos seleccionados` : 'Haz clic para seleccionar PDFs'}
                                </p>
                                <p className="text-[11px] text-[#9CA3AF] mt-1">Puedes seleccionar múltiples archivos PDF</p>
                                <input
                                    id="bulk-files"
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf"
                                    onChange={onFilesChange}
                                    className="hidden"
                                />
                            </label>

                            {files.length > 0 && (
                                <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl">
                                            <div className="w-6 h-6 rounded-md bg-[#EEF2FF] flex items-center justify-center shrink-0">
                                                <svg className="w-3.5 h-3.5 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <span className="text-[12px] font-semibold text-[#374151] truncate">{f.name}</span>
                                            <span className="text-[10px] text-[#9CA3AF] ml-auto shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fase: Cargando */}
                    {phase === 'uploading' && (
                        <div>
                            <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
                                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-[0.18em]">Procesando lote</p>
                                            <p className="mt-1 text-[24px] font-black text-[#0F172A]">
                                                {current} de {files.length} enviados
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#475569] border border-[#E2E8F0]">
                                            {Math.min(3, files.length)} concurrentes
                                        </span>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-white p-4">
                                        <div className="mb-3 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#94A3B8]">
                                            <span>Archivos del lote</span>
                                            <span>% NotebookLM</span>
                                        </div>
                                        <div className="space-y-2">
                                            {results.map((result, index) => (
                                                <div key={`${result.filename}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEF2F7] px-3 py-2.5">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[13px] font-extrabold text-[#111827]">{result.filename}</p>
                                                        <p className="truncate text-[11px] text-[#94A3B8]">
                                                            {result.pipeline_status && PIPELINE_STATUS_COPY[result.pipeline_status]
                                                                ? PIPELINE_STATUS_COPY[result.pipeline_status]
                                                                : result.alerts?.[0]?.msg ?? 'En espera'}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-extrabold text-[#5340FF]">
                                                        {getNotebookAvailabilityProgress(result)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/70 px-3 py-3 border border-[#E8ECF4]">
                                        <svg className="w-4 h-4 text-[#5340FF] animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        <p className="text-[12px] leading-relaxed text-[#6B7280]">
                                            Enviamos varios archivos en paralelo. El 100% se alcanza cuando cada uno queda disponible en NotebookLM.
                                        </p>
                                    </div>
                                </div>

                                <DonutProgress
                                    value={averageNotebookProgress}
                                    label="Avance real"
                                    hint="Subida, preparacion e indexacion hasta quedar listo en NotebookLM."
                                />
                            </div>

                            {/* Resultados parciales (se va llenando) */}
                            {results.length > 0 && (
                                <ResultsTable results={results} partial />
                            )}
                        </div>
                    )}

                    {/* Fase: Terminado */}
                    {phase === 'done' && (
                        <div>
                            {showAiProcessingRibbon && (
                                <div className="mb-5 rounded-[24px] border border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#eef2ff_100%)] px-5 py-4">
                                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-violet-600">Analizando IA</p>
                                    <p className="mt-1 text-[16px] font-black text-[#312E81]">
                                        El lote sigue en análisis automático
                                    </p>
                                    <p className="mt-2 text-[12px] leading-relaxed text-violet-700">
                                        NotebookLM y la IA están consultando la información cargada para completar los datos estructurados antes de dejarlos visibles en la carpeta.
                                    </p>
                                </div>
                            )}

                            {showReadyForReviewRibbon && (
                                <div className="mb-5 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_100%)] px-5 py-4">
                                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-600">Disponible para revisión</p>
                                    <p className="mt-1 text-[16px] font-black text-[#065F46]">
                                        Los archivos válidos ya fueron cargados a la carpeta
                                    </p>
                                    <p className="mt-2 text-[12px] leading-relaxed text-emerald-700">
                                        Los documentos aceptados quedaron listos para revisión en la vista final. Los rechazados se informan por separado y no se muestran en la carpeta.
                                    </p>
                                </div>
                            )}

                            {/* Resumen */}
                            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[24px] p-5 mb-5">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-[0.18em]">Resumen del lote</p>
                                        <p className="text-[18px] font-extrabold text-[#0F172A] mt-1">
                                            {totalProcessed} archivo{totalProcessed !== 1 ? 's' : ''} procesado{totalProcessed !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2E8F0] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#475569]">
                                    {totalErrors > 0 ? 'Revisar errores' : totalDuplicates > 0 ? 'Duplicados detectados' : totalCritical > 0 ? 'Revisar criticos' : 'Carga completada'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                                        <p className="text-[24px] font-extrabold text-green-600">{totalOk}</p>
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-0.5">Sin Alertas</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                                        <p className="text-[24px] font-extrabold text-amber-600">{totalAlerts - totalCritical}</p>
                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Alertas</p>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                                        <p className="text-[24px] font-extrabold text-red-600">{totalCritical}</p>
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5">Críticos</p>
                                    </div>
                                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
                                        <p className="text-[24px] font-extrabold text-orange-600">{totalRejected}</p>
                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-0.5">Rechazados</p>
                                    </div>
                                    <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center">
                                        <p className="text-[24px] font-extrabold text-slate-600">{totalErrors}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Errores</p>
                                    </div>
                                </div>

                                <p className="mt-4 text-[12px] text-[#64748B] leading-relaxed">
                                    {bulkAnalyzeQueued
                                        ? 'El analisis IA del lote ya fue iniciado. Puedes cerrar este modal y seguir el avance desde la carpeta.'
                                        : totalCritical > 0
                                        ? 'Se detectaron documentos con hallazgos criticos. Conviene revisar esos casos primero.'
                                        : totalErrors > 0
                                            ? 'La carga termino con algunos errores. Puedes revisar el detalle por archivo mas abajo.'
                                            : totalDuplicates > 0
                                                ? 'Parte del lote ya existia en el sistema y no se volvió a cargar.'
                                            : totalRejected > 0
                                                ? 'Parte del lote fue rechazada por tipo incorrecto. Esos archivos no se incorporaron a la carpeta ni se enviaron a Google Drive o NotebookLM.'
                                                : usesNotebookPipeline
                                                    ? 'La carga termino. Desde aqui puedes lanzar el analisis IA masivo del lote cuando corresponda.'
                                                    : 'La carga finalizo. Puedes disparar el analisis IA del lote desde este mismo modal.'}
                                </p>
                            </div>

                            <AnalysisSummaryPanel
                                acceptedResults={acceptedResults}
                                reviewResults={reviewResults}
                                rejectedResults={rejectedResults}
                                pipelineMode={usesNotebookPipeline}
                            />

                            <ResultsTable
                                results={visibleResults}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-[#F3F4F6] bg-[#FAFAFA] shrink-0 flex items-center justify-between gap-3">
                    {phase === 'done' && (
                        <p className="text-[11px] text-[#9CA3AF]">
                            {bulkAnalyzeQueued
                                ? 'El lote ya quedó en segundo plano. La carpeta mostrará el avance real del procesamiento.'
                                : usesNotebookPipeline
                                ? 'Cuando el lote ya este cargado, puedes lanzar un unico analisis IA para todos los archivos validos.'
                                : 'El analisis IA del lote se puede iniciar desde aqui, sin hacerlo archivo por archivo.'}
                        </p>
                    )}
                    <div className="flex gap-3 ml-auto">
                        {phase !== 'uploading' && (
                            <button
                                onClick={handleClose}
                                className="h-10 px-5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition"
                            >
                                {phase === 'done' ? 'Cerrar' : 'Cancelar'}
                            </button>
                        )}
                        {phase === 'select' && files.length > 0 && (
                            <button
                                onClick={startUpload}
                                className="h-10 px-6 bg-[#5340FF] hover:bg-[#4330E0] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-indigo-200 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                Iniciar Carga ({files.length} archivos)
                            </button>
                        )}
                        {phase === 'done' && (
                            <button
                                onClick={triggerBulkAnalyze}
                                disabled={!canRunBulkAnalyze || bulkAnalyzeQueued}
                                className="h-10 px-6 bg-[#5340FF] hover:bg-[#4330E0] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-[#5340FF]"
                            >
                                <svg className={`w-4 h-4 ${bulkAnalyzing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {bulkAnalyzing ? (
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    )}
                                    {bulkAnalyzing && (
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    )}
                                </svg>
                                {bulkAnalyzing ? 'Analizando lote...' : bulkAnalyzeQueued ? 'Analisis IA iniciado' : `Analisis IA (${analyzableResults.length})`}
                            </button>
                        )}
                        {phase === 'done' && (
                            <button
                                onClick={refreshCategories}
                                className="h-10 px-6 bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-emerald-200 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {bulkAnalyzeQueued ? 'Ver progreso en carpeta' : 'Ver Carpetas Actualizadas'}
                            </button>
                        )}
                    </div>
                </div>
                </div>
            </div>
        </>
    );
}

function AnalysisSummaryPanel({ acceptedResults = [], reviewResults = [], rejectedResults = [], pipelineMode = false }) {
    if (acceptedResults.length === 0 && reviewResults.length === 0 && rejectedResults.length === 0) {
        return null;
    }

    return (
        <div className="mb-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-green-200 bg-green-50/70 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-green-700">{pipelineMode ? 'Cargados al lote' : 'Documentos OK'}</p>
                        <p className="mt-1 text-[22px] font-black text-green-800">{acceptedResults.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-green-600 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-green-700">
                    {pipelineMode
                        ? 'Estos archivos ya fueron incorporados al lote y quedaron en cola para NotebookLM. La validación documental ocurre después, durante el análisis.'
                        : 'Estos archivos pasaron el filtro inicial y quedaron aceptados para el flujo de la carpeta.'}
                </p>

                {acceptedResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {acceptedResults.map((result, index) => (
                            <div key={`${result.filename}-accepted-${index}`} className="rounded-2xl border border-green-200 bg-white px-3 py-2.5">
                                <p className="truncate text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                                <p className="mt-1 text-[11px] text-green-700">
                                    {result.resumen ?? result.alerts?.[0]?.msg ?? 'Archivo incorporado correctamente al flujo.'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-[24px] border border-yellow-200 bg-yellow-50/70 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-yellow-700">Revisión manual</p>
                        <p className="mt-1 text-[22px] font-black text-yellow-800">{reviewResults.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-yellow-600 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
                        </svg>
                    </div>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-yellow-700">
                    Estos archivos no quedaron aceptados automáticamente. El filtro inicial no pudo confirmar con seguridad si corresponden al tipo documental esperado.
                </p>

                {reviewResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {reviewResults.map((result, index) => (
                            <div key={`${result.filename}-review-${index}`} className="rounded-2xl border border-yellow-200 bg-white px-3 py-2.5">
                                <p className="truncate text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                                <p className="mt-1 text-[11px] text-yellow-700">
                                    {result.analysis_data?.motivo_rechazo
                                        ?? result.resumen
                                        ?? result.alerts?.[0]?.msg
                                        ?? 'Requiere revisión manual antes de incorporarlo al flujo.'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-[24px] border border-orange-200 bg-orange-50/70 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-700">Documentos rechazados</p>
                        <p className="mt-1 text-[22px] font-black text-orange-800">{rejectedResults.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-orange-600 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-orange-700">
                    Los rechazados no se incorporan al listado de la carpeta de examen y tampoco se envían a Google Drive o NotebookLM.
                </p>

                {rejectedResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {rejectedResults.map((result, index) => (
                            <div key={`${result.filename}-rejected-${index}`} className="rounded-2xl border border-orange-200 bg-white px-3 py-2.5">
                                <p className="truncate text-[12px] font-extrabold text-[#111827]">{result.filename}</p>
                                <p className="mt-1 text-[11px] text-orange-700">
                                    {result.analysis_data?.motivo_rechazo
                                        ?? result.resumen
                                        ?? result.alerts?.[0]?.msg
                                        ?? 'El archivo no corresponde al tipo esperado para esta carpeta.'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* Tabla de resultados compartida entre uploading y done */
function ResultsTable({ results, partial = false }) {
    const BADGE = {
        clean: { cls: 'bg-green-50 text-green-600 border-green-200', label: 'Sin alertas', iconWrap: 'bg-green-100', icon: 'text-green-600' },
        alert: { cls: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Alerta', iconWrap: 'bg-amber-100', icon: 'text-amber-600' },
        critical: { cls: 'bg-red-50 text-red-600 border-red-200', label: 'Crítico', iconWrap: 'bg-red-100', icon: 'text-red-600' },
        pending: { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: 'Pendiente', iconWrap: 'bg-gray-200', icon: 'text-gray-500' },
        error: { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: 'Error', iconWrap: 'bg-gray-200', icon: 'text-gray-500' },
        rejected: { cls: 'bg-orange-50 text-orange-600 border-orange-200', label: 'Rechazado', iconWrap: 'bg-orange-100', icon: 'text-orange-600' },
        duplicate: { cls: 'bg-sky-50 text-sky-600 border-sky-200', label: 'Ya existe', iconWrap: 'bg-sky-100', icon: 'text-sky-600' },
    };

    const ALERT_ICON = {
        critical: 'text-red-500',
        alert: 'text-amber-500',
        error: 'text-gray-400',
        info: 'text-blue-400',
        warning: 'text-sky-500',
    };

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">
                {partial ? 'Progreso' : 'Resultados'} — {results.length} archivo{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((r, i) => {
                const displayStatus = getResultDisplayStatus(r);
                const badge = (displayStatus === 'pending' && r.pipeline_status && PIPELINE_STATUS[r.pipeline_status])
                    ? {
                        cls: `${PIPELINE_STATUS[r.pipeline_status].bg} ${PIPELINE_STATUS[r.pipeline_status].text} border-transparent`,
                        label: PIPELINE_STATUS[r.pipeline_status].label,
                        iconWrap: 'bg-white/60',
                        icon: PIPELINE_STATUS[r.pipeline_status].text,
                    }
                    : (BADGE[displayStatus] ?? BADGE.pending);
                const primaryAlert = r.alerts?.[0]?.msg ?? null;
                const secondaryText = r.worker_name
                    ? `Trabajador: ${r.worker_name}`
                    : displayStatus === 'rejected'
                        ? 'No incorporado a la carpeta'
                    : r.pipeline_error
                        ? 'Error en el pipeline'
                        : r.pipeline_status && PIPELINE_STATUS_COPY[r.pipeline_status]
                            ? PIPELINE_STATUS_COPY[r.pipeline_status]
                            : 'Sin trabajador detectado';
                const secondaryTone = r.worker_name
                    ? 'text-[#475569] font-semibold'
                    : displayStatus === 'rejected'
                        ? 'text-orange-600 font-semibold'
                    : r.pipeline_error
                        ? 'text-red-500'
                        : 'text-[#94A3B8]';

                return (
                    <div key={i} className="bg-white border border-[#E5E7EB] rounded-[22px] px-4 py-4 shadow-sm shadow-slate-100/60">
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${badge.iconWrap}`}>
                                <svg className={`w-5 h-5 ${badge.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {displayStatus === 'clean' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />}
                                    {displayStatus === 'alert' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />}
                                    {displayStatus === 'critical' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v5m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />}
                                    {displayStatus === 'rejected' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />}
                                    {displayStatus === 'duplicate' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />}
                                    {(displayStatus === 'pending' || displayStatus === 'error' || !['clean', 'alert', 'critical', 'rejected', 'duplicate'].includes(displayStatus)) && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />}
                                </svg>
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-extrabold text-[#111827] truncate">{r.filename}</p>
                                        <p className={`text-[11px] mt-1 truncate ${secondaryTone}`}>
                                            {secondaryText}
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-2">
                                        <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>

                                {primaryAlert && (
                                    <div className="mt-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
                                        <div className="flex items-start gap-2">
                                            <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${ALERT_ICON[r.alerts[0].type] ?? 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-[11px] text-[#475569] leading-relaxed">{primaryAlert}</p>
                                        </div>
                                    </div>
                                )}

                                {displayStatus === 'rejected' && (
                                    <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-700">
                                            Archivo rechazado
                                        </p>
                                        <p className="mt-1 text-[12px] leading-relaxed text-orange-700">
                                            {r.analysis_data?.motivo_rechazo
                                                ?? r.resumen
                                                ?? primaryAlert
                                                ?? 'El archivo no corresponde al tipo de documento requerido para esta carpeta.'}
                                        </p>
                                        <p className="mt-2 text-[11px] font-semibold text-orange-600">
                                            No fue incorporado al listado de la carpeta ni enviado a Google Drive o NotebookLM.
                                        </p>
                                    </div>
                                )}

                                {r.alerts && r.alerts.length > 1 && (
                                    <div className="mt-2 space-y-1.5">
                                        {r.alerts.slice(1).map((a, j) => (
                                            <div key={j} className="flex items-start gap-2 pl-1">
                                                <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${ALERT_ICON[a.type] ?? 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <p className="text-[11px] text-[#64748B] leading-relaxed">{a.msg}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {r.resumen && (
                                    <p className="mt-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#F1F5F9] pt-3">
                                        {r.resumen}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
