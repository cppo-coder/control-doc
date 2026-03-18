import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function StatCard({ label, value, trend, color, icon }) {
    return (
        <div className="bg-white p-6 rounded-[24px] border border-[#EAECF0] shadow-sm hover:shadow-md transition cursor-default">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                    </svg>
                </div>
                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{trend}</span>
            </div>
            <p className="text-[13px] font-bold text-[#6B7280] mb-1">{label}</p>
            <p className="text-3xl font-black text-[#111827]">{value}</p>
        </div>
    );
}

function NotebookLMStatusBadge({ status }) {
    const tones = {
        valid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        expired: 'bg-amber-100 text-amber-700 border-amber-200',
        missing_cookie: 'bg-amber-100 text-amber-700 border-amber-200',
        validation_error: 'bg-rose-100 text-rose-700 border-rose-200',
        missing_binary: 'bg-slate-200 text-slate-700 border-slate-300',
        error: 'bg-rose-100 text-rose-700 border-rose-200',
    };

    const labels = {
        valid: 'Operativa',
        expired: 'Vencida',
        missing_cookie: 'Sin cookie',
        validation_error: 'Error de validacion',
        missing_binary: 'MCP no instalado',
        error: 'Error',
    };

    const tone = tones[status] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] ${tone}`}>
            {labels[status] ?? status ?? 'Sin estado'}
        </span>
    );
}

function NotebookLMAdminCard({ initialStatus }) {
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);
    const [requestError, setRequestError] = useState(null);
    const [actionScreen, setActionScreen] = useState(null);
    const [copiedBlock, setCopiedBlock] = useState(null);
    const [cookieHeader, setCookieHeader] = useState('');
    const [requestUrl, setRequestUrl] = useState('');
    const [requestBody, setRequestBody] = useState('');
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState(null);

    const refreshStatus = async (fresh = true) => {
        setLoading(true);
        setRequestError(null);

        try {
            const { data } = await window.axios.get(route('notebooklm.status'), {
                params: { fresh: fresh ? 1 : 0 },
            });

            setStatus(data.notebooklm);
        } catch (error) {
            const nextStatus = error?.response?.data?.notebooklm;
            if (nextStatus) {
                setStatus(nextStatus);
            }

            setRequestError(
                nextStatus?.validation_error
                ?? error?.response?.data?.message
                ?? 'No fue posible consultar el estado de NotebookLM.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const needsRenewal = Boolean(status?.renewal_required)
        || ['expired', 'missing_cookie'].includes(status?.status);

    const runtimeHome = status?.runtime_home ?? 'Configura NOTEBOOKLM_RUNTIME_HOME';
    const configHome = status?.config_home ?? `${runtimeHome}/.config`;
    const accountEmail = status?.account_email ?? 'cuenta-tecnica@empresa.cl';

    const loginCommands = [
        `export HOME=${runtimeHome}`,
        `export XDG_CONFIG_HOME=${configHome}`,
        'notebooklm-mcp-auth',
    ].join('\n');

    const captureCommand = 'php artisan notebooklm:capture-session --browser=edge';

    const verifyCommands = [
        'php artisan notebooklm:auth-status --fresh',
        'php artisan notebooklm:auth-status --fresh --json',
    ].join('\n');

    const summaryTone = needsRenewal
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50';

    const openVerifyScreen = async () => {
        setActionScreen('verify');
        await refreshStatus(true);
    };

    const openRenewScreen = () => {
        setImportMessage(null);
        setActionScreen('renew');
    };

    const importSession = async () => {
        if (!cookieHeader.trim()) {
            setRequestError('Pega el valor completo del header cookie antes de importar.');

            return;
        }

        setImporting(true);
        setRequestError(null);
        setImportMessage(null);

        try {
            const { data } = await window.axios.post(route('notebooklm.import'), {
                cookie_header: cookieHeader,
                request_url: requestUrl || null,
                request_body: requestBody || null,
            });

            setStatus(data.notebooklm);
            setImportMessage(data.message ?? 'Sesión importada correctamente.');
            setCookieHeader('');
            setRequestUrl('');
            setRequestBody('');
            setActionScreen('verify');
        } catch (error) {
            const nextStatus = error?.response?.data?.notebooklm;
            if (nextStatus) {
                setStatus(nextStatus);
            }

            setRequestError(
                error?.response?.data?.errors?.cookie_header?.[0]
                ?? error?.response?.data?.message
                ?? 'No fue posible importar la sesión de NotebookLM.'
            );
        } finally {
            setImporting(false);
        }
    };

    const copyText = async (value, key) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedBlock(key);
            window.setTimeout(() => setCopiedBlock(current => current === key ? null : current), 1800);
        } catch (_) {
            setRequestError('No fue posible copiar el comando.');
        }
    };

    return (
        <>
        <div className="lg:col-span-3 overflow-hidden rounded-[32px] border border-[#EAECF0] bg-white shadow-sm">
            <div className="border-b border-[#EAECF0] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] px-8 py-7 text-white">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-100">
                            NotebookLM Admin
                        </div>
                        <h3 className="text-[24px] font-black tracking-tight">Sesion tecnica</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <NotebookLMStatusBadge status={status?.status} />
                        <button
                            type="button"
                            onClick={openRenewScreen}
                            className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2.5 text-[12px] font-extrabold text-slate-950 transition hover:bg-amber-300"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Renovar
                        </button>
                        <button
                            type="button"
                            onClick={openVerifyScreen}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[12px] font-extrabold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m14.836 2A8.001 8.001 0 005.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.837-2m14.837 2H15" />
                            </svg>
                            {loading ? 'Verificando...' : 'Verificar'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-8 py-8">
                <div className="grid gap-4 xl:grid-cols-4">
                    <div className={`rounded-[28px] border p-6 xl:col-span-2 ${summaryTone}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Estado</p>
                                <p className="mt-2 text-[20px] font-black text-[#111827]">
                                    {needsRenewal ? 'Renovar sesion' : 'Sesion valida'}
                                </p>
                                {(status?.validation_error || requestError) && (
                                    <p className="mt-2 text-[12px] font-semibold text-[#7C2D12]">
                                        {status?.validation_error ?? requestError}
                                    </p>
                                )}
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${needsRenewal ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {needsRenewal ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.338 16c-.77 1.333.192 3 1.732 3z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    )}
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] p-6">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Cuenta</p>
                        <p className="mt-2 break-all text-[15px] font-black text-[#0F172A]">{accountEmail}</p>
                    </div>

                    <div className="rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] p-6">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Verificado</p>
                        <p className="mt-2 text-[15px] font-black text-[#0F172A]">
                            {status?.checked_at ? new Date(status.checked_at).toLocaleString('es-CL') : 'Pendiente'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        {actionScreen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/60 px-4 backdrop-blur-[4px]">
                <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-7 py-5">
                        <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">NotebookLM</p>
                            <h4 className="mt-1 text-[18px] font-black text-[#0F172A]">
                                {actionScreen === 'renew' ? 'Renovar sesion' : 'Verificar sesion'}
                            </h4>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActionScreen(null)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#64748B] transition hover:bg-[#EEF2FF] hover:text-[#4338CA]"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="px-7 py-7">
                        {actionScreen === 'renew' ? (
                            <div className="space-y-4">
                                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FFF7ED] p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9A3412]">Captura asistida</p>
                                            <p className="mt-2 text-[14px] font-bold text-[#7C2D12]">
                                                Renovacion recomendada. Abre Edge con depuracion remota, captura automaticamente el request de NotebookLM e importa la sesion sin copiar DevTools.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(captureCommand, 'capture')}
                                            className="rounded-xl bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9A3412] transition hover:bg-orange-50"
                                        >
                                            {copiedBlock === 'capture' ? 'Copiado' : 'Copiar comando'}
                                        </button>
                                    </div>
                                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 text-[12px] leading-6 text-[#111827] shadow-sm"><code>{captureCommand}</code></pre>
                                </div>
                                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FFF7ED] p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9A3412]">Importacion manual</p>
                                            <p className="mt-2 text-[14px] font-bold text-[#7C2D12]">
                                                Fallback manual. Pega la cookie y, si la tienes, tambien el <code>Request URL</code> y <code>request body</code> del mismo <code>batchexecute</code>.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText('SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...;', 'cookie-example')}
                                            className="rounded-xl bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9A3412] transition hover:bg-orange-50"
                                        >
                                            {copiedBlock === 'cookie-example' ? 'Copiado' : 'Copiar ejemplo'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={cookieHeader}
                                        onChange={(event) => setCookieHeader(event.target.value)}
                                        rows={5}
                                        placeholder="SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...;"
                                        className="mt-4 w-full rounded-2xl border border-[#FDBA74] bg-white px-4 py-3 text-[12px] text-[#111827] shadow-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-orange-100"
                                    />
                                    <input
                                        type="text"
                                        value={requestUrl}
                                        onChange={(event) => setRequestUrl(event.target.value)}
                                        placeholder="https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?..."
                                        className="mt-4 w-full rounded-2xl border border-[#FDBA74] bg-white px-4 py-3 text-[12px] text-[#111827] shadow-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-orange-100"
                                    />
                                    <textarea
                                        value={requestBody}
                                        onChange={(event) => setRequestBody(event.target.value)}
                                        rows={4}
                                        placeholder="f.req=...&at=..."
                                        className="mt-4 w-full rounded-2xl border border-[#FDBA74] bg-white px-4 py-3 text-[12px] text-[#111827] shadow-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-orange-100"
                                    />
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={importSession}
                                            disabled={importing}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-[#F97316] px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            <svg className={`h-4 w-4 ${importing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            {importing ? 'Importando...' : 'Importar Sesión'}
                                        </button>
                                    </div>
                                </div>
                                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#0F172A] p-6 text-white">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <h5 className="text-[16px] font-black">Comando de renovacion</h5>
                                        <button
                                            type="button"
                                            onClick={() => copyText(loginCommands, 'renew')}
                                            className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white transition hover:bg-white/20"
                                        >
                                            {copiedBlock === 'renew' ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <pre className="overflow-x-auto rounded-2xl bg-black/30 p-4 text-[12px] leading-6 text-slate-100"><code>{loginCommands}</code></pre>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={openVerifyScreen}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m14.836 2A8.001 8.001 0 005.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.837-2m14.837 2H15" />
                                        </svg>
                                        {loading ? 'Verificando...' : 'Verificar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`rounded-[28px] border p-6 ${summaryTone}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Resultado</p>
                                            <p className="mt-2 text-[20px] font-black text-[#111827]">
                                                {loading ? 'Verificando...' : needsRenewal ? 'Renovar sesion' : 'Sesion valida'}
                                            </p>
                                            {(status?.validation_error || requestError) && (
                                                <p className="mt-2 text-[12px] font-semibold text-[#7C2D12]">
                                                    {status?.validation_error ?? requestError}
                                                </p>
                                            )}
                                            {importMessage && (
                                                <p className="mt-2 text-[12px] font-semibold text-emerald-700">
                                                    {importMessage}
                                                </p>
                                            )}
                                        </div>
                                        <NotebookLMStatusBadge status={status?.status} />
                                    </div>
                                </div>
                                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#111827] p-6 text-white">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <h5 className="text-[16px] font-black">Comando de verificacion</h5>
                                        <button
                                            type="button"
                                            onClick={() => copyText(verifyCommands, 'verify')}
                                            className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white transition hover:bg-white/20"
                                        >
                                            {copiedBlock === 'verify' ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <pre className="overflow-x-auto rounded-2xl bg-black/30 p-4 text-[12px] leading-6 text-slate-100"><code>{verifyCommands}</code></pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

export default function Dashboard() {
    const { props } = usePage();
    const user = props.auth.user;
    const stats = props.stats ?? { projects: 0, workers: 0, courses: 0, documents: 0 };
    const recentProjects = props.recentProjects ?? [];
    const isAdmin = Boolean(props.isAdmin);
    const notebooklmStatus = props.notebooklmStatus ?? null;

    const cards = [
        {
            label: 'Faenas / Proyectos',
            value: stats.projects,
            trend: stats.projects === 1 ? '1 activo' : `${stats.projects} activos`,
            color: 'bg-blue-600',
            icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
        },
        {
            label: 'Documentos',
            value: stats.documents,
            trend: 'en sistema',
            color: 'bg-emerald-500',
            icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        },
        {
            label: 'Trabajadores',
            value: stats.workers,
            trend: 'registrados',
            color: 'bg-violet-500',
            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        },
        {
            label: 'Cursos',
            value: stats.courses,
            trend: 'en sistema',
            color: 'bg-amber-500',
            icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-[24px] font-black tracking-tight text-[#111827]">Dashboard</h2>
                    <p className="text-[13px] font-medium text-[#6B7280]">Bienvenido de nuevo, {user.name}</p>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {cards.map((stat, idx) => (
                        <StatCard key={idx} {...stat} />
                    ))}
                </div>

                {isAdmin && <NotebookLMAdminCard initialStatus={notebooklmStatus} />}

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Proyectos recientes */}
                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-[#EAECF0] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-[#EAECF0] flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-[#111827]">Proyectos Recientes</h3>
                            <Link
                                href={route('projects.index')}
                                className="text-[12px] font-bold text-[#5340FF] hover:underline transition"
                            >
                                Ver Todos
                            </Link>
                        </div>
                        <div className="p-8">
                            {recentProjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="w-14 h-14 bg-[#F3F4F8] rounded-full flex items-center justify-center mb-3">
                                        <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-[14px] font-semibold text-[#374151]">No hay proyectos aún</p>
                                    <p className="text-[12px] text-[#9CA3AF] mt-1">Crea tu primer proyecto en la sección Archivos en Drive.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {recentProjects.map((project) => (
                                        <Link
                                            key={project.id}
                                            href={route('categories.index', project.id)}
                                            className="flex items-center gap-4 p-4 rounded-2xl hover:bg-[#F9FAFB] transition group"
                                        >
                                            <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[14px] font-bold text-[#111827] truncate group-hover:text-[#5340FF] transition">{project.name}</p>
                                                <p className="text-[12px] text-[#9CA3AF]">
                                                    {new Date(project.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <svg className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#5340FF] transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel IA */}
                    <div className="bg-white rounded-[32px] p-8 border border-[#EAECF0] shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-[#EEF2FF] rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-[16px] font-black text-[#111827] mb-2">Procesamiento IA</h3>
                        <p className="text-[13px] text-[#6B7280] leading-relaxed">
                            Todos los documentos subidos son analizados automáticamente para detectar alertas críticas.
                        </p>
                        {stats.documents > 0 && (
                            <div className="mt-6 w-full bg-[#F3F4F8] rounded-xl p-4">
                                <p className="text-[12px] font-bold text-[#374151]">{stats.documents} documento{stats.documents !== 1 ? 's' : ''} en sistema</p>
                                <div className="mt-2 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#5340FF] rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (stats.documents / 10) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
