import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router, Link, usePoll } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import { useConfirm } from '@/Components/ConfirmModal';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Ayudante para detectar carpetas de examen de forma robusta e ignorar acentos
const isExamenFolder = (name) => {
    if (!name) return false;
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('examen');
};

export default function Index({ project, categories }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '' });

    // Automatic polling to sync document states every 5 seconds
    usePoll(5000, { only: ['categories'], preserveScroll: true });

    const onCreateCategory = (e) => {
        e.preventDefault();
        post(route('categories.store', project.id), { onSuccess: () => reset('name') });
    };

    return (
        <AuthenticatedLayout
            header={
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
                            <CategoryRow key={category.id} category={category} index={idx} />
                        ))}
                    </div>
                </div>
            </div>

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
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const runBulkAnalysis = async () => {
        // Obtenemos los documentos que necesitan análisis
        const toAnalyze = category.documents.filter(d =>
            !d.analysis_status || d.analysis_status === 'pending' || d.analysis_status === 'error'
        );

        if (toAnalyze.length === 0) return;

        setAnalyzing(true);
        setProgress({ current: 0, total: toAnalyze.length });

        for (let i = 0; i < toAnalyze.length; i++) {
            const doc = toAnalyze[i];
            setProgress({ current: i + 1, total: toAnalyze.length });

            try {
                // Usamos axios que es más robusto y maneja el CSRF automáticamente
                await axios.post(route('documents.analyze', doc.id));

                // Esperar 4 segundos (para cumplir con 15 RPM de Free Tier de Gemini)
                if (i < toAnalyze.length - 1) {
                    await new Promise(r => setTimeout(r, 4000));
                }
            } catch (e) {
                console.error("Bulk analysis error", e);
            }
        }

        setAnalyzing(false);
        // Recargar solo los datos de categorías al finalizar para reflejar los resultados
        router.reload({ only: ['categories'], preserveScroll: true });
    };

    // Verificamos si la categoría es de examen de manera robusta
    if (!isExamenFolder(category.name)) return null;

    // Verificamos si hay archivos que requieran acción
    const hasPending = category.documents.some(d =>
        !d.analysis_status || d.analysis_status === 'pending' || d.analysis_status === 'error'
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
                    PROCESANDO ({progress.current}/{progress.total})
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Análisis Masivo
                </>
            )}
        </button>
    );
}

function CategoryRow({ category, index }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [saving, setSaving] = useState(false);
    // Abrir automáticamente si hay documentos para que el usuario los vea tras la carga
    const [open, setOpen] = useState(category.documents.length > 0);

    // Cuando Inertia recarga la página con nuevos documentos, abrir el acordeón
    useEffect(() => {
        if (category.documents.length > 0) setOpen(true);
    }, [category.documents.length]);

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

    return (
        <div className="px-6 py-5">
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
                                <button
                                    onClick={() => setEditing(true)}
                                    title="Renombrar carpeta"
                                    className="opacity-0 group-hover/name:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#EEF2FF] hover:text-[#5340FF] transition-all"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                            </div>
                        )}
                        {/* Contador de documentos — siempre desde la prop actualizada por Inertia */}
                        <button
                            onClick={() => setOpen(o => !o)}
                            className="mt-1 inline-flex items-center gap-1 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest transition cursor-pointer"
                        >
                            {category.documents.length} Items
                            <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <BulkAnalyzeButton category={category} />
                    <UploadDocumentForm category={category} isExamen={isExamenFolder(category.name)} />
                </div>
            </div>

            {/* Lista de documentos — controlada por open */}
            {open && category.documents.length > 0 && (
                <div className="mt-4 ml-[60px] space-y-3">
                    {category.documents.map(doc => (
                        <DocumentRow
                            key={doc.id}
                            doc={doc}
                            category={category}
                        />
                    ))}
                </div>
            )}

            {/* Mensaje cuando está abierto pero vacío */}
            {open && category.documents.length === 0 && (
                <div className="mt-4 ml-[60px] py-4 text-center">
                    <p className="text-[11px] text-[#9CA3AF] font-semibold">Sin documentos en esta carpeta</p>
                </div>
            )}
        </div>
    );
}


function UploadDocumentForm({ category }) {
    const [open, setOpen] = useState(false);
    const [fileStates, setFileStates] = useState([]); // { file, progress, status: 'waiting'|'uploading'|'done'|'error' }
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);

    const getCsrf = () => {
        const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    };

    const addFiles = (selected) => {
        const pdfs = Array.from(selected).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (!pdfs.length) return;
        setFileStates(prev => [
            ...prev,
            ...pdfs.map(file => ({ file, progress: 0, status: 'waiting', error: null })),
        ]);
    };

    const onFilesChange = (e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; };
    const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
    const onDrop = (e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

    const removeFile = (idx) => setFileStates(prev => prev.filter((_, i) => i !== idx));

    const uploadFile = (item, idx) => new Promise(resolve => {
        const fd = new FormData();
        fd.append('document', item.file);
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
                setFileStates(prev => prev.map((f, i) => i === idx ? { ...f, progress: Math.round((e.loaded / e.total) * 100) } : f));
        };
        xhr.onload = () => {
            const ok = xhr.status >= 200 && xhr.status < 300;
            let errMsg = null;
            try { const j = JSON.parse(xhr.responseText); errMsg = j.errors?.document?.[0] ?? null; } catch (_) { }
            setFileStates(prev => prev.map((f, i) => i === idx ? { ...f, progress: 100, status: ok ? 'done' : 'error', error: errMsg } : f));
            resolve();
        };
        xhr.onerror = () => {
            setFileStates(prev => prev.map((f, i) => i === idx ? { ...f, status: 'error', error: 'Error de red' } : f));
            resolve();
        };
        xhr.open('POST', route('documents.store', category.id));
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-XSRF-TOKEN', getCsrf());
        xhr.withCredentials = true;
        setFileStates(prev => prev.map((f, i) => i === idx ? { ...f, status: 'uploading' } : f));
        xhr.send(fd);
    });

    const startUpload = async () => {
        setUploading(true);
        const waiting = fileStates.map((f, i) => ({ ...f, _idx: i })).filter(f => f.status === 'waiting');

        for (let j = 0; j < waiting.length; j++) {
            const item = waiting[j];
            await uploadFile(item, item._idx);

            // Si no es el último archivo, esperar 2 segundos para no saturar la cuota de la API
            if (j < waiting.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        setUploading(false);
        router.reload({ preserveScroll: true });
    };

    const hasPending = fileStates.some(f => f.status === 'waiting');
    const allDone = fileStates.length > 0 && fileStates.every(f => f.status === 'done' || f.status === 'error');

    const handleClose = () => { if (uploading) return; setOpen(false); setFileStates([]); setDragging(false); };

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => setOpen(true)}
                className="h-9 px-4 flex items-center gap-1.5 bg-[#EEF2FF] hover:bg-indigo-100 text-[#5340FF] text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition whitespace-nowrap"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Agregar PDF
            </button>

            {/* Modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && handleClose()}
                >
                    <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-[#EAECF0]">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
                            <div>
                                <h2 className="text-[13px] font-extrabold text-[#111827] uppercase tracking-widest">Subir PDFs</h2>
                                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{category.name}</p>
                            </div>
                            {!uploading && (
                                <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

                            {/* Drop Zone */}
                            <div
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                className={`flex flex-col items-center justify-center gap-4 py-10 rounded-2xl border-2 border-dashed transition-all ${dragging ? 'border-[#5340FF] bg-[#EEF2FF] scale-[1.01]' : 'border-[#D1D5DB] bg-[#FAFAFA] hover:border-[#5340FF] hover:bg-[#F5F5FF]'
                                    }`}
                            >
                                {/* Cloud SVG */}
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

                            {/* File list */}
                            {fileStates.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest">Archivos seleccionados</p>
                                    {fileStates.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl px-4 py-3">

                                            {/* Estado icono */}
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

                                            {/* Nombre + barra */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[12px] font-semibold text-[#374151] truncate max-w-[170px]">{item.file.name}</span>
                                                    <span className="text-[11px] font-bold text-[#5340FF] ml-2 shrink-0">
                                                        {item.status === 'error' ? 'Error' : `${item.status === 'done' ? 100 : item.progress}%`}
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-400' : 'bg-[#5340FF]'}`}
                                                        style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Quitar */}
                                            {!uploading && item.status !== 'uploading' && (
                                                <button onClick={() => removeFile(idx)} className="shrink-0 w-6 h-6 flex items-center justify-center text-[#D1D5DB] hover:text-[#6B7280] transition">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {fileStates.length > 0 && (
                            <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3">
                                {allDone ? (
                                    <>
                                        <span className="text-[11px] font-bold text-green-600">
                                            {fileStates.filter(f => f.status === 'done').length} archivo{fileStates.filter(f => f.status === 'done').length !== 1 ? 's' : ''} subido{fileStates.filter(f => f.status === 'done').length !== 1 ? 's' : ''}
                                        </span>
                                        <button onClick={handleClose} className="h-9 px-6 bg-[#5340FF] hover:bg-[#4330E0] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition">
                                            Cerrar
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[11px] text-[#9CA3AF]">
                                            {fileStates.filter(f => f.status === 'waiting').length} pendiente{fileStates.filter(f => f.status === 'waiting').length !== 1 ? 's' : ''}
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
            )}
        </>
    );
}


/* ─── Mapa de estilos por estado ─── */

const STATUS = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Pendiente', dot: 'bg-gray-400' },
    clean: { bg: 'bg-green-50', text: 'text-green-600', label: 'Sin alertas', dot: 'bg-green-500' },
    alert: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Alerta', dot: 'bg-amber-500' },
    critical: { bg: 'bg-red-50', text: 'text-red-600', label: 'Crítico', dot: 'bg-red-500' },
    error: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Error', dot: 'bg-gray-400' },
    rejected: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'No es examen', dot: 'bg-orange-400' },
    analyzing: { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Analizando...', dot: 'bg-indigo-400 animate-pulse' },
};

function DocumentRow({ doc, category }) {
    const [open, setOpen] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();
    const queryClient = useQueryClient();

    // Automatic Mutation Management
    const { mutate: performAnalyze, isPending } = useMutation({
        mutationFn: async () => {
            return axios.post(route('documents.analyze', doc.id));
        },
        onSuccess: () => {
            // Trigger automatic synchronization of state
            router.reload({ only: ['categories'], preserveScroll: true });
        }
    });

    const isInternalAnalyzing = doc.analysis_status === 'pending' && isPending;
    const st = isPending ? STATUS.analyzing : (STATUS[doc.analysis_status] ?? STATUS.pending);
    const d = doc.analysis_data;

    const analyze = () => performAnalyze();

    const handleDelete = () => askConfirm({
        title: '¿Eliminar archivo?',
        message: `Se eliminará "${doc.name}" de Google Drive. Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        variant: 'danger',
        onConfirm: () => router.delete(route('documents.destroy', doc.id), { preserveScroll: true }),
    });

    return (
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl overflow-hidden">
            {/* Row header */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#374151] truncate">{doc.name}</p>
                        {doc.analysis_data?.trabajador && (
                            <p className="text-[11px] text-[#9CA3AF] truncate">{doc.analysis_data.trabajador}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Badge estado */}
                    {isExamenFolder(category.name) && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                            {st.label}
                        </span>
                    )}

                    {/* Botón Analizar / Re-analizar */}
                    {isExamenFolder(category.name) && (
                        <button
                            onClick={analyze}
                            disabled={isPending}
                            title={doc.analysis_status === 'error' ? 'Re-intentar análisis' : 'Analizar con IA'}
                            className={`h-8 px-3 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition disabled:opacity-50 whitespace-nowrap shadow-sm 
                                ${doc.analysis_status === 'error'
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
                            {doc.analysis_status === 'error' ? 'Re-intentar' : (doc.analysis_status && doc.analysis_status !== 'pending' ? 'Re-analizar' : 'Analizar')}
                        </button>
                    )}

                    {/* Toggle resultado */}
                    {d && (
                        <button
                            onClick={() => setOpen(o => !o)}
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
                    {/* Resumen */}
                    {d.resumen && (
                        <p className="text-[13px] text-[#374151] leading-relaxed">{d.resumen}</p>
                    )}

                    {/* Grid de alertas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* IMC */}
                        <div className={`rounded-2xl p-4 border ${d.imc?.critico ? 'bg-red-50 border-red-200' : d.imc?.alerta ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
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
                            <p className="text-[11px] text-[#6B7280] mt-1">{d.imc?.detalle}</p>
                        </div>

                        {/* Drogas */}
                        <div className={`rounded-2xl p-4 border ${d.drogas?.alerta ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280]">Toxicología</span>
                                {d.drogas?.alerta ? (
                                    <span className="text-[10px] font-extrabold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">Positivo</span>
                                ) : (
                                    <span className="text-[10px] font-extrabold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">Negativo</span>
                                )}
                            </div>
                            {d.drogas?.sustancias?.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {d.drogas.sustancias.map((s, i) => (
                                        <span key={i} className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{s}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[13px] font-bold text-[#111827]">Sin detección</p>
                            )}
                            <p className="text-[11px] text-[#6B7280] mt-1">{d.drogas?.detalle}</p>
                        </div>
                    </div>

                    {/* Otros hallazgos */}
                    {d.otros_hallazgos?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Otros Hallazgos</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {d.otros_hallazgos.map((h, i) => (
                                    <div key={i} className={`rounded-xl p-3 border ${h.alerta ? 'bg-amber-50 border-amber-200' : 'bg-[#F9FAFB] border-[#EAECF0]'}`}>
                                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{h.titulo}</p>
                                        <p className={`text-[13px] font-extrabold mt-0.5 ${h.alerta ? 'text-amber-600' : 'text-[#111827]'}`}>{h.valor}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Estado general */}
                    {d.estado_general && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#F3F4F6]">
                            <span className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest">Aptitud:</span>
                            <span className={`text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full ${d.estado_general === 'apto' ? 'bg-green-50 text-green-600' :
                                d.estado_general === 'apto_con_restricciones' ? 'bg-amber-50 text-amber-600' :
                                    d.estado_general === 'no_apto' ? 'bg-red-50 text-red-600' :
                                        'bg-gray-100 text-gray-500'
                                }`}>
                                {d.estado_general.replace(/_/g, ' ')}
                            </span>
                            {d.fecha_examen && <span className="text-[11px] text-[#9CA3AF] ml-auto">{d.fecha_examen}</span>}
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
     1. Extrae texto del PDF
     2. Analiza con Gemini (nombre trabajador + alertas)
     3. Crea carpeta en Drive: Project/WorkerName/file.pdf
     4. Guarda en BD
   El frontend muestra progreso en tiempo real.
══════════════════════════════════════════════════════ */
function BulkUploadModal({ project, onClose }) {
    const fileInputRef = useRef(null);
    const [phase, setPhase] = useState('select');  // 'select' | 'uploading' | 'done'
    const [files, setFiles] = useState([]);
    const [current, setCurrent] = useState(0);
    const [results, setResults] = useState([]);

    const onFilesChange = (e) => {
        const selected = Array.from(e.target.files);
        setFiles(selected);
        setPhase('select');
        setResults([]);
    };

    const getCsrfToken = () => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const startUpload = async () => {
        if (files.length === 0) return;
        setPhase('uploading');
        setResults([]);
        setCurrent(0);

        const allResults = [];

        for (let i = 0; i < files.length; i++) {
            setCurrent(i + 1);

            const formData = new FormData();
            formData.append('file', files[i]);
            formData.append('_token', getCsrfToken());

            try {
                const response = await fetch(
                    route('projects.bulk-upload', project.id),
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        credentials: 'same-origin',
                        body: formData,
                    }
                );

                const json = await response.json();
                allResults.push(json);
            } catch (err) {
                allResults.push({
                    success: false,
                    filename: files[i].name,
                    worker_name: null,
                    status: 'error',
                    alerts: [{ type: 'error', msg: 'Error de red: ' + err.message }],
                });
            }

            setResults([...allResults]);
        }

        setPhase('done');
    };

    const totalAlerts = results.filter(r => r.status === 'alert' || r.status === 'critical').length;
    const totalCritical = results.filter(r => r.status === 'critical').length;
    const totalOk = results.filter(r => r.status === 'clean').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F19]/60 backdrop-blur-[6px] transition-all duration-300">
            <div className="bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] w-full max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-[#EAECF0] animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-[#F3F4F6] bg-[#FAFAFA] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#5340FF] flex items-center justify-center shadow-md shadow-indigo-200">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[15px] font-extrabold text-[#111827] uppercase tracking-wide">Carga Masiva de Exámenes</h2>
                            <p className="text-[11px] text-[#9CA3AF] font-medium mt-0.5">Analiza con IA · Organiza por trabajador en Drive</p>
                        </div>
                    </div>
                    {phase !== 'uploading' && (
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
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
                            {/* Barra de progreso */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[12px] font-bold text-[#374151]">
                                        Procesando archivo {current} de {files.length}…
                                    </span>
                                    <span className="text-[11px] font-bold text-[#5340FF]">
                                        {Math.round((current / files.length) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                                    <div
                                        className="h-2 bg-[#5340FF] rounded-full transition-all duration-500"
                                        style={{ width: `${(current / files.length) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <svg className="w-4 h-4 text-[#5340FF] animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    <p className="text-[12px] text-[#6B7280]">
                                        Extrayendo texto · Analizando con Gemini IA · Guardando en Drive…
                                    </p>
                                </div>
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
                            {/* Resumen */}
                            <div className="grid grid-cols-3 gap-3 mb-5">
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
                            </div>

                            <ResultsTable results={results} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-4 border-t border-[#F3F4F6] bg-[#FAFAFA] shrink-0 flex items-center justify-between gap-3">
                    {phase === 'done' && (
                        <p className="text-[11px] text-[#9CA3AF]">
                            Las carpetas fueron creadas automáticamente en Google Drive por trabajador.
                        </p>
                    )}
                    <div className="flex gap-3 ml-auto">
                        {phase !== 'uploading' && (
                            <button
                                onClick={onClose}
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
                                onClick={() => window.location.reload()}
                                className="h-10 px-6 bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-emerald-200 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Ver Carpetas Actualizadas
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Tabla de resultados compartida entre uploading y done */
function ResultsTable({ results, partial = false }) {
    const BADGE = {
        clean: { cls: 'bg-green-50 text-green-600', label: 'Sin alertas' },
        alert: { cls: 'bg-amber-50 text-amber-600', label: 'Alerta' },
        critical: { cls: 'bg-red-50 text-red-600', label: 'Crítico' },
        pending: { cls: 'bg-gray-100 text-gray-500', label: 'Pendiente' },
        error: { cls: 'bg-gray-100 text-gray-500', label: 'Error' },
        rejected: { cls: 'bg-orange-50 text-orange-600', label: 'No es examen' },
    };

    const ALERT_ICON = {
        critical: 'text-red-500',
        alert: 'text-amber-500',
        error: 'text-gray-400',
        info: 'text-blue-400',
    };

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">
                {partial ? 'Progreso' : 'Resultados'} — {results.length} archivo{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((r, i) => {
                const badge = BADGE[r.status] ?? BADGE.pending;
                return (
                    <div key={i} className="bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#111827] truncate">{r.filename}</p>
                                {r.worker_name && (
                                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                                        👤 {r.worker_name}
                                    </p>
                                )}
                            </div>
                            <span className={`shrink-0 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${badge.cls}`}>
                                {badge.label}
                            </span>
                        </div>

                        {/* Alertas detectadas */}
                        {r.alerts && r.alerts.length > 0 && (
                            <div className="mt-2.5 space-y-1.5">
                                {r.alerts.map((a, j) => (
                                    <div key={j} className="flex items-start gap-2">
                                        <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${ALERT_ICON[a.type] ?? 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-[11px] text-[#6B7280] leading-relaxed">{a.msg}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Resumen general */}
                        {r.resumen && (
                            <p className="mt-2 text-[11px] text-[#9CA3AF] italic leading-relaxed border-t border-[#F3F4F6] pt-2">
                                {r.resumen}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

