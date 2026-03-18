import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

const STATUS_STYLES = {
    vigente: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    por_vencer: 'bg-amber-50 text-amber-700 border border-amber-200',
    pendiente: 'bg-slate-50 text-slate-600 border border-slate-200',
    vencido: 'bg-rose-50 text-rose-700 border border-rose-200',
};

const STATUS_LABELS = {
    vigente: 'Vigente',
    por_vencer: 'Por vencer',
    pendiente: 'Pendiente',
    vencido: 'Vencido',
};

const DOCUMENT_ICON_STYLES = {
    vigente: {
        wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-600',
        symbol: 'check',
    },
    por_vencer: {
        wrapper: 'border-amber-200 bg-amber-50 text-amber-600',
        symbol: 'dots',
    },
    pendiente: {
        wrapper: 'border-slate-200 bg-slate-50 text-slate-400',
        symbol: 'dash',
    },
    vencido: {
        wrapper: 'border-rose-200 bg-rose-50 text-rose-600',
        symbol: 'cross',
    },
};

function normalizePaginationLabel(label) {
    if (label.includes('&laquo;') || label.includes('Previous')) return 'prev';
    if (label.includes('&raquo;') || label.includes('Next')) return 'next';
    if (label.includes('...')) return 'ellipsis';
    return 'page';
}

function buildPaginationItems(paginated) {
    const links = paginated.links ?? [];

    if (links.length > 0) {
        return links.map((link) => ({
            ...link,
            key: `${link.label}-${link.url ?? 'null'}`,
        }));
    }

    return [
        { key: 'prev', label: 'Previous', url: null, active: false },
        { key: 'page-1', label: String(paginated.current_page ?? 1), url: null, active: true },
        { key: 'next', label: 'Next', url: null, active: false },
    ];
}

function visitPagination(url) {
    if (!url) return;

    router.get(url, {}, {
        preserveState: true,
        preserveScroll: true,
        replace: true,
    });
}

function initialsForWorker(worker) {
    return `${worker.nombres?.charAt(0) ?? ''}${worker.apellido_paterno?.charAt(0) ?? ''}`.trim() || 'SN';
}

function complianceTone(percentage) {
    if (percentage >= 90) {
        return 'border-emerald-200 bg-emerald-50/85 text-emerald-800';
    }

    if (percentage >= 70) {
        return 'border-amber-200 bg-amber-50/85 text-amber-800';
    }

    return 'border-rose-200 bg-rose-50/85 text-rose-800';
}

function SortIcon({ active, direction }) {
    if (!active) {
        return <span className="text-[10px] text-[#D0D5DD]">↑↓</span>;
    }

    return (
        <span className="text-[10px] text-[#F97316]">
            {direction === 'asc' ? '↑' : '↓'}
        </span>
    );
}

function DocumentStatusIcon({ checked, status }) {
    const visual = DOCUMENT_ICON_STYLES[status] ?? DOCUMENT_ICON_STYLES.pendiente;

    return (
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${checked ? visual.wrapper : DOCUMENT_ICON_STYLES.pendiente.wrapper}`}>
            {checked && visual.symbol === 'check' && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
            )}
            {checked && visual.symbol === 'cross' && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" d="M6 18L18 6M6 6l12 12" />
                </svg>
            )}
            {checked && visual.symbol === 'dots' && (
                <span className="text-[13px] font-black tracking-[-0.08em]">...</span>
            )}
            {!checked && (
                <span className="text-[13px] font-black">-</span>
            )}
        </span>
    );
}

function SummaryCard({ title, value, copy, tone = 'emerald', icon }) {
    const tones = {
        emerald: 'border-emerald-200 bg-[#F0FDF7] text-emerald-800',
        amber: 'border-[#FCD34D] bg-[#FFF9EB] text-[#9A3412]',
        rose: 'border-[#FBCFE8] bg-[#FFF5F7] text-[#9F1239]',
    };

    return (
        <div className={`h-full rounded-[20px] border px-4 py-3 ${tones[tone]}`}>
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70">
                    {icon}
                </div>
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em]">{title}</p>
                    <p className="mt-1 text-[26px] font-black tracking-[-0.04em]">{value}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-current/80">{copy}</p>
                </div>
            </div>
        </div>
    );
}

function CompactMetricCard({ title, value, copy, tone = 'slate' }) {
    const tones = {
        slate: 'border-[#E5E7EB] bg-white text-[#111827]',
        amber: 'border-[#FCD34D] bg-[#FFF9EB] text-[#9A3412]',
        rose: 'border-[#FBCFE8] bg-[#FFF5F7] text-[#9F1239]',
        emerald: 'border-[#A7F3D0] bg-[#F0FDF7] text-[#047857]',
    };

    return (
        <div className={`rounded-[18px] border px-4 py-3 shadow-sm ${tones[tone]}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-current/70">{title}</p>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.04em] text-current">{value}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-current/75">{copy}</p>
        </div>
    );
}

export default function Checklist({ workers, projects = [], selectedProject = null, checklistCategories = [], filters = {} }) {
    const [search, setSearch] = useState(filters.search || '');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'missingCount', direction: 'desc' });
    const paginationItems = buildPaginationItems(workers);

    const submitFilters = (next = {}) => {
        router.get(route('workers.checklist'), {
            search,
            project_id: filters.project_id ?? selectedProject?.id ?? '',
            ...next,
        }, {
            preserveState: true,
            replace: true,
        });
    };

    const rowWorkers = workers.data ?? [];
    const checklistWithRule = checklistCategories.filter((category) => Boolean(category.document_type));
    const workerRows = rowWorkers.map((worker) => {
        const docsByType = new Map((worker.documents ?? []).map((document) => [document.tipo, document]));
        const missingCount = checklistWithRule.reduce((total, category) => {
            const document = docsByType.get(category.document_type);

            return total + (document?.tiene_documento ? 0 : 1);
        }, 0);

        return {
            ...worker,
            docsByType,
            missingCount,
            completedCount: checklistWithRule.length - missingCount,
        };
    });

    const departmentOptions = useMemo(() => ([
        'all',
        ...Array.from(new Set(workerRows.map((worker) => worker.department).filter(Boolean))),
    ]), [workerRows]);

    const filteredWorkerRows = useMemo(() => {
        if (departmentFilter === 'all') {
            return workerRows;
        }

        return workerRows.filter((worker) => (worker.department ?? 'Sin área') === departmentFilter);
    }, [departmentFilter, workerRows]);

    const sortedWorkers = useMemo(() => {
        const rows = [...filteredWorkerRows];

        rows.sort((left, right) => {
            const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;

            if (sortConfig.key === 'worker') {
                const leftValue = `${left.apellido_paterno ?? ''} ${left.apellido_materno ?? ''} ${left.nombres ?? ''}`.trim().toLowerCase();
                const rightValue = `${right.apellido_paterno ?? ''} ${right.apellido_materno ?? ''} ${right.nombres ?? ''}`.trim().toLowerCase();

                return leftValue.localeCompare(rightValue) * directionFactor;
            }

            const leftValue = Number(left[sortConfig.key] ?? 0);
            const rightValue = Number(right[sortConfig.key] ?? 0);

            if (leftValue === rightValue) {
                return `${left.apellido_paterno ?? ''} ${left.nombres ?? ''}`.localeCompare(`${right.apellido_paterno ?? ''} ${right.nombres ?? ''}`) * directionFactor;
            }

            return (leftValue - rightValue) * directionFactor;
        });

        return rows;
    }, [filteredWorkerRows, sortConfig]);

    const workersWithMissing = sortedWorkers.filter((worker) => worker.missingCount > 0).length;
    const totalMissingDocuments = sortedWorkers.reduce((total, worker) => total + worker.missingCount, 0);
    const totalExpectedDocuments = sortedWorkers.length * checklistWithRule.length;
    const totalCompletedDocuments = sortedWorkers.reduce((total, worker) => total + worker.completedCount, 0);
    const compliancePercentage = totalExpectedDocuments > 0
        ? Math.round((totalCompletedDocuments / totalExpectedDocuments) * 1000) / 10
        : 0;
    const pendingReviewCount = sortedWorkers.reduce((total, worker) => (
        total + checklistWithRule.reduce((workerTotal, category) => {
            const document = category.document_type ? worker.docsByType.get(category.document_type) : null;

            return workerTotal + (document?.estado === 'por_vencer' || document?.estado === 'pendiente' ? 1 : 0);
        }, 0)
    ), 0);
    const criticalMissingCount = sortedWorkers.reduce((total, worker) => (
        total + checklistWithRule.reduce((workerTotal, category) => {
            const document = category.document_type ? worker.docsByType.get(category.document_type) : null;

            return workerTotal + (document?.estado === 'vencido' || !document?.tiene_documento ? 1 : 0);
        }, 0)
    ), 0);
    const compliantWorkers = sortedWorkers.filter((worker) => worker.missingCount === 0).length;
    const progressBarWidth = Math.max(6, Math.min(100, compliancePercentage));

    const toggleSort = (key) => {
        setSortConfig((current) => (
            current.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: key === 'worker' || key === 'position' ? 'asc' : 'desc' }
        ));
    };

    return (
        <AuthenticatedLayout
            header={null}
        >
            <Head title="Check List Personal" />

            <div className="space-y-6">
                <div className={`grid gap-3 ${selectedProject ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
                    <div className="min-w-0">
                        <SummaryCard
                            title="Cumplimiento general"
                            value={`${compliancePercentage}%`}
                            copy={`${totalCompletedDocuments} de ${totalExpectedDocuments} documentos requeridos se encuentran al día.`}
                            tone={compliancePercentage >= 90 ? 'emerald' : (compliancePercentage >= 70 ? 'amber' : 'rose')}
                            icon={(
                                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        />
                    </div>

                    <div className="min-w-0">
                        <SummaryCard
                            title="Pendiente revisión"
                            value={pendingReviewCount}
                            copy="Documentos pendientes o por vencer dentro de las carpetas visibles."
                            tone="amber"
                            icon={(
                                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
                                </svg>
                            )}
                        />
                    </div>

                    <div className="min-w-0">
                        <SummaryCard
                            title="Faltantes críticos"
                            value={criticalMissingCount}
                            copy="Documentos ausentes o vencidos que hoy bloquean el cumplimiento."
                            tone="rose"
                            icon={(
                                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M12 9v3.75m0 3.75h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
                                </svg>
                            )}
                        />
                    </div>

                    {selectedProject && (
                        <div className="min-w-0">
                        <CompactMetricCard
                            title="Trabajadores al día"
                            value={compliantWorkers}
                            copy="Personas sin faltantes en las carpetas del proyecto."
                            tone="emerald"
                        />
                        </div>
                    )}
                </div>

                <div className="rounded-[32px] border border-[#E5E7EB] bg-white overflow-hidden">
                    <div className="p-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
                                    <div className="relative w-full lg:w-96">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                            <svg className="h-4 w-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setSearch(value);
                                                router.get(route('workers.checklist'), {
                                                    search: value,
                                                    project_id: filters.project_id ?? selectedProject?.id ?? '',
                                                }, {
                                                    preserveState: true,
                                                    replace: true,
                                                });
                                            }}
                                            placeholder="Buscar trabajador..."
                                            className="block w-full rounded-2xl border border-[#EAECF0] bg-[#F8FAFC] py-3 pl-11 pr-4 text-[13px] outline-none transition-all focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                                        />
                                    </div>

                                    <div className="w-full lg:w-72">
                                        <select
                                            value={filters.project_id ?? selectedProject?.id ?? ''}
                                            onChange={(e) => submitFilters({ project_id: e.target.value })}
                                            className="w-full rounded-2xl border border-[#EAECF0] bg-[#F8FAFC] px-4 py-3 text-[13px] font-semibold text-[#374151] outline-none transition-all focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
                                        >
                                            {projects.map((project) => (
                                                <option key={project.id} value={project.id}>
                                                    {project.name} ({project.categories_count} carpetas)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="text-[12px] font-semibold text-[#64748B]">
                                    {selectedProject
                                        ? `${selectedProject.name} · ${checklistCategories.length} carpetas · ${workerRows.length} trabajadores${sortedWorkers.length !== workerRows.length ? ` · ${sortedWorkers.length} filas visibles` : ''}`
                                        : 'Sin proyecto'}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDepartmentFilter('all')}
                                    className={`rounded-full px-4 py-2 text-[12px] font-extrabold transition ${
                                        departmentFilter === 'all'
                                            ? 'bg-[#F97316] text-white'
                                            : 'border border-[#E5E7EB] bg-white text-[#475467] hover:border-[#D0D5DD] hover:bg-[#F8FAFC]'
                                    }`}
                                >
                                    Todas las áreas
                                </button>
                                {departmentOptions.filter((option) => option !== 'all').map((department) => (
                                    <button
                                        key={department}
                                        type="button"
                                        onClick={() => setDepartmentFilter(department)}
                                        className={`rounded-full px-4 py-2 text-[12px] font-extrabold transition ${
                                            departmentFilter === department
                                                ? 'bg-[#111827] text-white'
                                                : 'border border-[#E5E7EB] bg-white text-[#475467] hover:border-[#D0D5DD] hover:bg-[#F8FAFC]'
                                        }`}
                                    >
                                        {department}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-[#F8FAFC]">
                                    <th className="px-6 py-5 text-[12px] font-black uppercase tracking-[0.16em] text-[#667085]">
                                        <button type="button" onClick={() => toggleSort('worker')} className="inline-flex items-center gap-2">
                                            <span>Trabajador</span>
                                            <SortIcon active={sortConfig.key === 'worker'} direction={sortConfig.direction} />
                                        </button>
                                    </th>
                                    {checklistCategories.map((category) => (
                                        <th key={category.id} className="min-w-[150px] px-4 py-5 text-center text-[12px] font-black uppercase tracking-[0.16em] text-[#667085]">
                                            {category.name}
                                        </th>
                                    ))}
                                    <th className="px-6 py-5 text-center text-[12px] font-black uppercase tracking-[0.16em] text-[#667085]">
                                        <button type="button" onClick={() => toggleSort('missingCount')} className="inline-flex items-center gap-2">
                                            <span>Faltan</span>
                                            <SortIcon active={sortConfig.key === 'missingCount'} direction={sortConfig.direction} />
                                        </button>
                                    </th>
                                    <th className="px-6 py-5 text-center text-[12px] font-black uppercase tracking-[0.16em] text-[#667085]">
                                        <button type="button" onClick={() => toggleSort('completedCount')} className="inline-flex items-center gap-2">
                                            <span>Cumple</span>
                                            <SortIcon active={sortConfig.key === 'completedCount'} direction={sortConfig.direction} />
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAECF0]">
                                {sortedWorkers.length > 0 ? sortedWorkers.map((worker) => (
                                    <tr key={worker.id} className="transition-colors hover:bg-[#FCFCFD]">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-[13px] font-black text-[#475467]">
                                                    {initialsForWorker(worker)}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-[14px] font-black leading-tight text-[#111827]">{worker.nombres} {worker.apellido_paterno}</p>
                                                    </div>
                                                    <p className="text-[12px] text-[#667085]">{worker.rut || worker.pasaporte || 'Sin identificación'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {checklistCategories.map((category) => {
                                            const document = category.document_type ? worker.docsByType.get(category.document_type) : null;
                                            const checked = Boolean(document?.tiene_documento);
                                            const status = document?.estado ?? 'pendiente';
                                            const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.pendiente;

                                            return (
                                                <td key={`${worker.id}_${category.id}`} className="px-4 py-3.5 align-middle">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <DocumentStatusIcon checked={checked} status={status} />
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusStyle}`}>
                                                            {STATUS_LABELS[status] ?? status}
                                                        </span>
                                                        {document?.fecha_vencimiento && (
                                                            <span className="text-center text-[10px] font-semibold text-[#98A2B3]">
                                                                {new Date(`${document.fecha_vencimiento}T12:00:00`).toLocaleDateString('es-CL')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-3.5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-black ${
                                                    worker.missingCount > 0
                                                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                                                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {worker.missingCount}
                                                </span>
                                                <span className="text-[10px] font-semibold text-[#98A2B3]">
                                                    {worker.completedCount}/{checklistWithRule.length} OK
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-center">
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-black ${complianceTone(checklistWithRule.length > 0 ? (worker.completedCount / checklistWithRule.length) * 100 : 0)}`}>
                                                {checklistWithRule.length > 0 ? Math.round((worker.completedCount / checklistWithRule.length) * 100) : 0}%
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={checklistCategories.length + 3} className="px-6 py-20 text-center">
                                            <p className="text-[15px] font-bold text-[#374151]">No se encontraron trabajadores</p>
                                            <p className="mt-1 text-[13px] text-[#6B7280]">Prueba con otra búsqueda, área o proyecto.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-[#EAECF0] bg-white px-6 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="text-[13px] font-medium text-[#667085]">
                                Showing {workers.from ?? 0} to {workers.to ?? 0} of {workers.total ?? sortedWorkers.length} entries
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {paginationItems.map((link) => {
                                    const labelType = normalizePaginationLabel(link.label);
                                    const displayLabel = labelType === 'prev'
                                        ? 'Previous'
                                        : labelType === 'next'
                                            ? 'Next'
                                            : labelType === 'ellipsis'
                                                ? '...'
                                                : link.label;

                                    if (labelType === 'ellipsis') {
                                        return (
                                            <span
                                                key={link.key}
                                                className="flex h-9 min-w-[36px] items-center justify-center px-1 text-[13px] font-medium text-[#9CA3AF]"
                                            >
                                                {displayLabel}
                                            </span>
                                        );
                                    }

                                    if (!link.url) {
                                        return (
                                            <span
                                                key={link.key}
                                                className={`flex h-9 items-center justify-center text-[13px] font-medium ${
                                                    labelType === 'page'
                                                        ? 'min-w-[36px] rounded-full text-[#9CA3AF] opacity-50'
                                                        : 'min-w-[72px] rounded-lg border border-[#E5E7EB] px-3 text-[#9CA3AF] opacity-50'
                                                }`}
                                            >
                                                {displayLabel}
                                            </span>
                                        );
                                    }

                                    return (
                                        <button
                                            key={link.key}
                                            type="button"
                                            onClick={() => visitPagination(link.url)}
                                            className={`flex h-9 items-center justify-center text-[13px] font-medium transition-all ${
                                                labelType === 'page'
                                                    ? (link.active
                                                        ? 'min-w-[36px] rounded-full bg-[#1D4ED8] text-white'
                                                        : 'min-w-[36px] rounded-full text-[#2563EB] hover:bg-[#EFF6FF]')
                                                    : 'min-w-[72px] rounded-lg border border-[#E5E7EB] px-3 text-[#64748B] hover:bg-[#F8FAFC]'
                                            }`}
                                        >
                                            {displayLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
