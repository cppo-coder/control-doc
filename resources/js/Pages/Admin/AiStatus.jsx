import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function StatusPill({ tone = 'slate', children }) {
    const tones = {
        emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-100 text-amber-700 border-amber-200',
        rose: 'bg-rose-100 text-rose-700 border-rose-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        slate: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] ${tones[tone] ?? tones.slate}`}>
            {children}
        </span>
    );
}

function MetricCard({ label, value, tone = 'slate' }) {
    const backgrounds = {
        emerald: 'bg-emerald-50 border-emerald-200',
        amber: 'bg-amber-50 border-amber-200',
        rose: 'bg-rose-50 border-rose-200',
        blue: 'bg-blue-50 border-blue-200',
        slate: 'bg-white border-[#EAECF0]',
    };

    return (
        <div className={`rounded-[24px] border p-5 ${backgrounds[tone] ?? backgrounds.slate}`}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{label}</p>
            <p className="mt-3 text-[28px] font-black text-[#111827]">{value}</p>
        </div>
    );
}

function notebookTone(status) {
    if (status?.ok) {
        return 'emerald';
    }

    if (['expired', 'missing_cookie'].includes(status?.status)) {
        return 'amber';
    }

    if (status?.status) {
        return 'rose';
    }

    return 'slate';
}

function routeTone(routeItem) {
    if (!routeItem.enabled) {
        return 'slate';
    }

    if (!routeItem.has_credentials) {
        return 'amber';
    }

    if (routeItem.cooldown_active) {
        return 'rose';
    }

    return 'emerald';
}

function routeLabel(routeItem) {
    if (!routeItem.enabled) {
        return 'Deshabilitada';
    }

    if (!routeItem.has_credentials) {
        return 'Sin credenciales';
    }

    if (routeItem.cooldown_active) {
        return 'En cooldown';
    }

    return 'Disponible';
}

function providerTone(statusLabel) {
    if (statusLabel === 'operativo') {
        return 'emerald';
    }

    if (statusLabel === 'rate_limited' || statusLabel === 'cooldown') {
        return 'rose';
    }

    if (statusLabel === 'sin_credenciales') {
        return 'amber';
    }

    return 'slate';
}

function MonitorTable({ monitor }) {
    const rows = monitor?.rows ?? [];

    return (
        <>
            <div className="border-b border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,#0f766e22,transparent_40%),linear-gradient(135deg,#050816_0%,#081126_45%,#0b1220_100%)] px-8 py-7">
                <div className="font-mono text-emerald-400">
                    <p className="text-[18px] font-bold">=== Monitoreo de Rate Limits de IA en Tiempo Real ===</p>
                    <p className="mt-2 text-[14px] text-slate-200">
                        Hora actual servidor: <span className="text-white">{monitor?.server_time ?? 'Sin datos'}</span>
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto px-4 py-5 sm:px-8">
                <table className="min-w-full border-separate border-spacing-0 font-mono text-[14px] text-slate-100">
                    <thead>
                        <tr className="text-emerald-400">
                            <th className="border border-emerald-500/30 px-4 py-3 text-left">Tier</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-left">Driver</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-left">Modelo</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-right">RPM (Req)</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-right">RPD (Req)</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-right">TPM (Tok)</th>
                            <th className="border border-emerald-500/30 px-4 py-3 text-right">TPD (Tok)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={`${row.driver}-${row.model}-${index}`} className="odd:bg-white/[0.015]">
                                <td className="border border-emerald-500/20 px-4 py-3 text-slate-200">{row.tier}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-slate-100">{row.driver}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-slate-100">{row.model}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-right text-slate-200">{row.rpm}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-right text-slate-200">{row.rpd}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-right text-slate-200">{row.tpm}</td>
                                <td className="border border-emerald-500/20 px-4 py-3 text-right text-slate-200">{row.tpd}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-emerald-500/20 px-8 py-4 font-mono text-[13px] text-emerald-400">
                Nota: <span className="text-slate-300">{monitor?.note ?? 'Sin nota disponible.'}</span>
            </div>
        </>
    );
}

function ModelChipGroup({ title, models, emptyLabel }) {
    return (
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{title}</p>
            {models?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {models.map((model) => (
                        <span
                            key={`${title}-${model}`}
                            className="inline-flex rounded-full border border-[#D6DAE1] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#334155]"
                        >
                            {model}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-[13px] font-medium text-[#6B7280]">{emptyLabel}</p>
            )}
        </div>
    );
}

function RotationSequenceCard({ title, models, emptyLabel }) {
    return (
        <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{title}</p>
            {models?.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {models.map((model, index) => (
                        <div key={`${title}-${model}`} className="flex items-center gap-2">
                            <span className="inline-flex rounded-full border border-[#D6DAE1] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155]">
                                {model}
                            </span>
                            {index < models.length - 1 && (
                                <span className="text-[12px] font-black text-[#94A3B8]">→</span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-[13px] font-medium text-[#6B7280]">{emptyLabel}</p>
            )}
        </div>
    );
}

function MixedRouteSequenceCard({ title, routes, emptyLabel }) {
    return (
        <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{title}</p>
            {routes?.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {routes.map((routeItem, index) => (
                        <div key={`${routeItem.provider}-${routeItem.model}-${index}`} className="flex items-center gap-2">
                            <span className="inline-flex rounded-full border border-[#D6DAE1] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155]">
                                {String(routeItem.provider).toUpperCase()} · {routeItem.model}
                            </span>
                            {index < routes.length - 1 && (
                                <span className="text-[12px] font-black text-[#94A3B8]">→</span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-[13px] font-medium text-[#6B7280]">{emptyLabel}</p>
            )}
        </div>
    );
}

function GenericProviderCard({ title, provider, fallbackLabel }) {
    return (
        <div className="rounded-[28px] border border-[#EAECF0] bg-white p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{title}</p>
                    <h4 className="mt-2 text-[20px] font-black text-[#111827]">
                        {provider?.credential_count ?? 0} credencial{(provider?.credential_count ?? 0) === 1 ? '' : 'es'} detectada{(provider?.credential_count ?? 0) === 1 ? '' : 's'}
                    </h4>
                    <p className="mt-2 text-[13px] font-medium text-[#475569]">
                        {provider?.message ?? fallbackLabel}
                    </p>
                </div>
                <StatusPill tone={providerTone(provider?.status_label)}>
                    {provider?.status_label === 'rate_limited' ? 'Cuota agotada' : provider?.status_label ?? 'sin estado'}
                </StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <MetricCard label="Credenciales" value={provider?.credential_count ?? 0} tone="blue" />
                <MetricCard label="Rutas sanas" value={provider?.healthy ?? 0} tone={(provider?.healthy ?? 0) > 0 ? 'emerald' : 'slate'} />
                <MetricCard label="Cooldown" value={provider?.cooling_down ?? 0} tone={(provider?.cooling_down ?? 0) > 0 ? 'rose' : 'slate'} />
            </div>

            <div className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Modelos configurados</p>
                    <StatusPill tone="blue">
                        {provider?.available_models_count ?? 0} modelos
                    </StatusPill>
                </div>

                {(provider?.available_models ?? []).length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {(provider?.available_models ?? []).map((model) => (
                            <span
                                key={`${title}-${model}`}
                                className="inline-flex rounded-full border border-[#D6DAE1] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155]"
                            >
                                {model}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="mt-4 text-[13px] font-medium text-[#6B7280]">
                        No hay modelos configurados para este proveedor.
                    </p>
                )}
            </div>
        </div>
    );
}

function GeminiMonitorProfiles({ gemini }) {
    return (
        <div className="border-t border-emerald-500/20 px-8 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-emerald-400">Gemini para documentos</p>
                    <p className="mt-2 text-[13px] font-medium text-slate-300">
                        {gemini?.message ?? 'Sin diagnostico de Gemini.'}
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-slate-400">
                        {gemini?.auto_rotation_message ?? 'La alternancia automatica no esta disponible.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="blue">{gemini?.credential_count ?? 0} keys</StatusPill>
                    <StatusPill tone={providerTone(gemini?.status_label)}>
                        {gemini?.status_label === 'rate_limited' ? 'Cuota agotada' : gemini?.status_label ?? 'sin estado'}
                    </StatusPill>
                </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div className="rounded-[20px] border border-emerald-500/20 bg-white/[0.03] p-4">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">PDF nativo</p>
                    {(gemini?.document_profiles?.pdf_nativo ?? []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(gemini?.document_profiles?.pdf_nativo ?? []).map((model) => (
                                <span key={`monitor-pdf-${model}`} className="inline-flex rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1.5 text-[12px] font-semibold text-slate-100">
                                    {model}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-[12px] font-medium text-slate-400">Sin modelos detectados para lectura nativa.</p>
                    )}
                </div>

                <div className="rounded-[20px] border border-emerald-500/20 bg-white/[0.03] p-4">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">OCR PDF</p>
                    {(gemini?.document_profiles?.ocr_pdf ?? []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(gemini?.document_profiles?.ocr_pdf ?? []).map((model) => (
                                <span key={`monitor-ocr-${model}`} className="inline-flex rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1.5 text-[12px] font-semibold text-slate-100">
                                    {model}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-[12px] font-medium text-slate-400">Sin modelos detectados para OCR.</p>
                    )}
                </div>

                <div className="rounded-[20px] border border-emerald-500/20 bg-white/[0.03] p-4">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">Revision por agotamiento</p>
                    {(gemini?.document_profiles?.revision_agotamiento ?? []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(gemini?.document_profiles?.revision_agotamiento ?? []).map((model) => (
                                <span key={`monitor-revision-${model}`} className="inline-flex rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1.5 text-[12px] font-semibold text-slate-100">
                                    {model}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-[12px] font-medium text-slate-400">Sin modelos de respaldo detectados.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AiStatus() {
    const { props } = usePage();
    const [notebookStatus, setNotebookStatus] = useState(props.notebooklmStatus);
    const [aiStatus, setAiStatus] = useState(props.aiBalancerStatus);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setNotebookStatus(props.notebooklmStatus);
        setAiStatus(props.aiBalancerStatus);
    }, [props.aiBalancerStatus, props.notebooklmStatus]);

    const refresh = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await window.axios.get(route('admin.ai-status.refresh'), {
                params: { fresh: 1 },
            });

            setNotebookStatus(data.notebooklm);
            setAiStatus(data.ai_balancer);
        } catch (requestError) {
            const payload = requestError?.response?.data;

            if (payload?.notebooklm) {
                setNotebookStatus(payload.notebooklm);
            }

            if (payload?.ai_balancer) {
                setAiStatus(payload.ai_balancer);
            }

            setError(payload?.message ?? 'No fue posible refrescar el estado de IA y NotebookLM.');
        } finally {
            setLoading(false);
        }
    };

    const updateRoute = async (payload) => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await window.axios.post(route('admin.ai-status.routes.update'), payload);
            setAiStatus(data.ai_balancer);
        } catch (requestError) {
            setError(requestError?.response?.data?.message ?? 'No fue posible actualizar la ruta del balanceador.');
        } finally {
            setLoading(false);
        }
    };

    const notebookStatusTone = notebookTone(notebookStatus);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-[24px] font-black tracking-tight text-[#111827]">IA y NotebookLM</h2>
                    <p className="text-[13px] font-medium text-[#6B7280]">Monitoreo administrativo del balanceador, proveedores y sesion tecnica.</p>
                </div>
            }
        >
            <Head title="IA y NotebookLM" />

            <div className="space-y-8">
                <div className="overflow-hidden rounded-[32px] border border-[#111827] bg-[#050816] shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
                    <MonitorTable monitor={aiStatus?.monitor} />
                    <GeminiMonitorProfiles gemini={aiStatus?.providers?.gemini} />
                </div>

                <section className="overflow-hidden rounded-[32px] border border-[#EAECF0] bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-[#EAECF0] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] px-8 py-7 text-white lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-100">
                                Centro de control
                            </div>
                            <h3 className="text-[24px] font-black tracking-tight">Balanceador y estado operativo</h3>
                            <p className="mt-2 max-w-3xl text-[14px] text-slate-200">
                                Vista unificada del estado de NotebookLM y de las rutas de IA configuradas en el balanceador.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={refresh}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[12px] font-extrabold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m14.836 2A8.001 8.001 0 005.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.837-2m14.837 2H15" />
                            </svg>
                            {loading ? 'Actualizando...' : 'Refrescar estado'}
                        </button>
                    </div>

                    {error && (
                        <div className="border-b border-rose-200 bg-rose-50 px-8 py-4 text-[13px] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-8 px-8 py-8 xl:grid-cols-[1.1fr_1fr]">
                        <div className="space-y-5">
                            <div className={`rounded-[28px] border p-6 ${notebookStatusTone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : notebookStatusTone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">NotebookLM</p>
                                        <h4 className="mt-2 text-[20px] font-black text-[#111827]">
                                            {notebookStatus?.ok ? 'Sesion valida' : notebookStatus?.message ?? 'Revision requerida'}
                                        </h4>
                                        <p className="mt-2 text-[13px] font-medium text-[#475569]">
                                            {notebookStatus?.validation_error ?? notebookStatus?.message ?? 'Sin datos de diagnostico.'}
                                        </p>
                                    </div>
                                    <StatusPill tone={notebookStatusTone}>
                                        {notebookStatus?.status ?? 'sin estado'}
                                    </StatusPill>
                                </div>
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <MetricCard label="Cuenta tecnica" value={notebookStatus?.account_email ?? 'No configurada'} tone="slate" />
                                    <MetricCard label="Ultima verificacion" value={notebookStatus?.checked_at ? new Date(notebookStatus.checked_at).toLocaleString('es-CL') : 'Pendiente'} tone="slate" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-[28px] border border-[#EAECF0] bg-[#F8FAFC] p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Balanceador IA</p>
                                        <h4 className="mt-2 text-[20px] font-black text-[#111827]">
                                            {aiStatus?.strategy ?? 'round_robin'}
                                        </h4>
                                    </div>
                                    <StatusPill tone={(aiStatus?.summary?.healthy ?? 0) > 0 ? 'emerald' : 'rose'}>
                                        {(aiStatus?.summary?.healthy ?? 0) > 0 ? 'Operativo' : 'Sin rutas'}
                                    </StatusPill>
                                </div>
                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <MetricCard label="Rutas sanas" value={aiStatus?.summary?.healthy ?? 0} tone="emerald" />
                                    <MetricCard label="Cooldown" value={aiStatus?.summary?.cooling_down ?? 0} tone={(aiStatus?.summary?.cooling_down ?? 0) > 0 ? 'rose' : 'slate'} />
                                    <MetricCard label="Configuradas" value={aiStatus?.summary?.configured ?? 0} tone="blue" />
                                    <MetricCard label="Sin credenciales" value={aiStatus?.summary?.missing_credentials ?? 0} tone={(aiStatus?.summary?.missing_credentials ?? 0) > 0 ? 'amber' : 'slate'} />
                                </div>
                                <div className="mt-5">
                                    <MixedRouteSequenceCard
                                        title="Secuencia mixta de proveedores"
                                        routes={aiStatus?.summary?.mixed_rotation ?? []}
                                        emptyLabel="No hay secuencia mixta disponible en este momento."
                                    />
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-[#EAECF0] bg-white p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Estado de Gemini</p>
                                        <h4 className="mt-2 text-[20px] font-black text-[#111827]">
                                            {aiStatus?.providers?.gemini?.credential_count ?? 0} keys detectadas
                                        </h4>
                                        <p className="mt-2 text-[13px] font-medium text-[#475569]">
                                            {aiStatus?.providers?.gemini?.message ?? 'Sin diagnostico de Gemini.'}
                                        </p>
                                    </div>
                                    <StatusPill tone={providerTone(aiStatus?.providers?.gemini?.status_label)}>
                                        {aiStatus?.providers?.gemini?.status_label === 'rate_limited' ? 'Cuota agotada' : aiStatus?.providers?.gemini?.status_label ?? 'sin estado'}
                                    </StatusPill>
                                </div>
                                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                    <MetricCard label="Keys detectadas" value={aiStatus?.providers?.gemini?.credential_count ?? 0} tone="blue" />
                                    <MetricCard label="Rutas sanas" value={aiStatus?.providers?.gemini?.healthy ?? 0} tone={(aiStatus?.providers?.gemini?.healthy ?? 0) > 0 ? 'emerald' : 'slate'} />
                                    <MetricCard label="Cooldown" value={aiStatus?.providers?.gemini?.cooling_down ?? 0} tone={(aiStatus?.providers?.gemini?.cooling_down ?? 0) > 0 ? 'rose' : 'slate'} />
                                </div>

                                <div className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Modelos disponibles en la API key</p>
                                        <StatusPill tone="blue">
                                            {aiStatus?.providers?.gemini?.available_models_count ?? 0} modelos
                                        </StatusPill>
                                    </div>

                                    {(aiStatus?.providers?.gemini?.available_models ?? []).length > 0 ? (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {(aiStatus?.providers?.gemini?.available_models ?? []).map((model) => (
                                                <button
                                                    key={model}
                                                    type="button"
                                                    onClick={() => updateRoute({ id: 'gemini-primary', model })}
                                                    className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                                                        (aiStatus?.routes ?? []).find((routeItem) => routeItem.id === 'gemini-primary')?.model === model
                                                            ? 'border-[#5340FF] bg-[#EEF2FF] text-[#4338CA]'
                                                            : 'border-[#D6DAE1] bg-white text-[#334155] hover:border-[#5340FF] hover:text-[#4338CA]'
                                                    }`}
                                                >
                                                    {model}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-[13px] font-medium text-[#6B7280]">
                                            No se pudo cargar la lista en este momento. Usa el botón de refresco para reintentar.
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-4">
                                    <ModelChipGroup
                                        title="PDF nativo"
                                        models={aiStatus?.providers?.gemini?.document_profiles?.pdf_nativo ?? []}
                                        emptyLabel="No hay modelos Gemini recomendados disponibles para lectura nativa en este momento."
                                    />
                                    <ModelChipGroup
                                        title="OCR PDF"
                                        models={aiStatus?.providers?.gemini?.document_profiles?.ocr_pdf ?? []}
                                        emptyLabel="No hay modelos Gemini recomendados disponibles para OCR en este momento."
                                    />
                                    <ModelChipGroup
                                        title="Revision por agotamiento"
                                        models={aiStatus?.providers?.gemini?.document_profiles?.revision_agotamiento ?? []}
                                        emptyLabel="No hay modelos de respaldo disponibles para revision por agotamiento."
                                    />
                                    <RotationSequenceCard
                                        title="Secuencia automatica PDF nativo"
                                        models={aiStatus?.providers?.gemini?.rotation_plan?.pdf_nativo ?? []}
                                        emptyLabel="No hay secuencia automatica disponible para PDF nativo."
                                    />
                                    <RotationSequenceCard
                                        title="Secuencia automatica OCR PDF"
                                        models={aiStatus?.providers?.gemini?.rotation_plan?.ocr_pdf ?? []}
                                        emptyLabel="No hay secuencia automatica disponible para OCR PDF."
                                    />
                                    <RotationSequenceCard
                                        title="Secuencia por agotamiento"
                                        models={aiStatus?.providers?.gemini?.rotation_plan?.revision_agotamiento ?? []}
                                        emptyLabel="No hay secuencia automatica de respaldo en este momento."
                                    />
                                </div>
                            </div>

                            <GenericProviderCard
                                title="Estado de Groq"
                                provider={aiStatus?.providers?.groq}
                                fallbackLabel="Sin diagnostico de Groq."
                            />

                            <GenericProviderCard
                                title="Estado de Cerebras"
                                provider={aiStatus?.providers?.cerebras}
                                fallbackLabel="Sin diagnostico de Cerebras."
                            />
                        </div>
                    </div>
                </section>

                <section className="rounded-[32px] border border-[#EAECF0] bg-white shadow-sm">
                    <div className="border-b border-[#EAECF0] px-8 py-6">
                        <h3 className="text-[18px] font-black text-[#111827]">Rutas del balanceador</h3>
                        <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
                            Estado por proveedor, modelo, peso y disponibilidad de cada ruta de fallback.
                        </p>
                    </div>

                    <div className="grid gap-5 px-8 py-8 lg:grid-cols-2">
                        {(aiStatus?.routes ?? []).map((routeItem) => (
                            <article key={routeItem.id} className="rounded-[28px] border border-[#EAECF0] bg-[#FCFCFD] p-6">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">{routeItem.provider}</p>
                                        <h4 className="mt-2 text-[18px] font-black text-[#111827]">{routeItem.model ?? 'Sin modelo'}</h4>
                                        <p className="mt-2 text-[12px] font-medium text-[#6B7280]">ID: {routeItem.id}</p>
                                    </div>
                                    <StatusPill tone={routeTone(routeItem)}>{routeLabel(routeItem)}</StatusPill>
                                </div>

                                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                    <MetricCard label="Peso" value={routeItem.weight} tone="blue" />
                                    <MetricCard label="Credenciales" value={routeItem.has_credentials ? 'OK' : 'Faltan'} tone={routeItem.has_credentials ? 'emerald' : 'amber'} />
                                    <MetricCard label="Cooldown" value={routeItem.cooldown_active ? 'Activo' : 'Libre'} tone={routeItem.cooldown_active ? 'rose' : 'slate'} />
                                </div>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => updateRoute({ id: routeItem.id, enabled: !routeItem.enabled })}
                                        className={`inline-flex items-center rounded-2xl px-4 py-2 text-[12px] font-extrabold transition ${
                                            routeItem.enabled
                                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                        }`}
                                    >
                                        {routeItem.enabled ? 'Desactivar ruta' : 'Activar ruta'}
                                    </button>
                                </div>

                                {routeItem.cooldown_active && routeItem.cooldown && (
                                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
                                        Cooldown por {routeItem.cooldown.reason ?? 'error transitorio'} desde {routeItem.cooldown.at ? new Date(routeItem.cooldown.at).toLocaleString('es-CL') : 'fecha desconocida'}.
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
