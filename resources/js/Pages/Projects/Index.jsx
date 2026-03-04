import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

export default function Index({ projects }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        code: '',
        description: '',
    });
    const onSubmit = (e) => {
        e.preventDefault();
        post(route('projects.store'), { onSuccess: () => reset() });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-[22px] font-extrabold text-[#111827] uppercase tracking-wide">
                        Proyectos / Faenas
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                            {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                        <span className="bg-[#EEF2FF] text-[#5340FF] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest">
                            Control Documental
                        </span>
                    </div>
                </div>
            }
        >
            <Head title="Proyectos / Faenas" />

            <div className="max-w-6xl mx-auto space-y-6">

                {/* ── Create Project Card ── */}
                <div className="bg-white rounded-[20px] border border-[#EAECF0] shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <svg className="w-4 h-4 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <h3 className="text-[11px] font-extrabold text-[#374151] uppercase tracking-[0.1em]">
                            Nuevo Proyecto / Faena
                        </h3>
                    </div>

                    <form onSubmit={onSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                    Nombre del Proyecto *
                                </label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData('name', e.target.value)}
                                    placeholder="Ej: Cierre Mina Norte"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/30 focus:border-[#5340FF] transition"
                                />
                                {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                    Código / N° Faena
                                </label>
                                <input
                                    type="text"
                                    value={data.code}
                                    onChange={e => setData('code', e.target.value)}
                                    placeholder="Ej: FAE-2026-01"
                                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/30 focus:border-[#5340FF] transition"
                                />
                                {errors.code && <p className="mt-1 text-[11px] text-red-500">{errors.code}</p>}
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                Descripción (opcional)
                            </label>
                            <textarea
                                value={data.description}
                                onChange={e => setData('description', e.target.value)}
                                placeholder="Descripción breve del proyecto o faena…"
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/30 focus:border-[#5340FF] transition resize-none"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                disabled={processing}
                                className="h-[46px] px-8 bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition shadow-sm shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                Crear Proyecto
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Projects List ── */}
                <div className="bg-white rounded-[20px] border border-[#EAECF0] shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-[#FAFAFA] border-b border-[#EAECF0]">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-[11px] font-extrabold text-[#374151] uppercase tracking-[0.1em]">
                                Proyectos Registrados
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                            {projects.length} Ítems
                        </span>
                    </div>

                    <div className="divide-y divide-[#F3F4F6]">
                        {projects.length === 0 && (
                            <div className="py-16 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[#F3F4F8] flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                    Sin proyectos registrados
                                </p>
                            </div>
                        )}

                        {projects.map((project, idx) => (
                            <div key={project.id} className="px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition">
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Index */}
                                    <div className="w-11 h-11 rounded-2xl bg-[#5340FF] flex items-center justify-center text-white text-[13px] font-extrabold shrink-0 shadow-md shadow-indigo-200">
                                        {String(idx + 1).padStart(2, '0')}
                                    </div>

                                    {/* Info */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-[15px] font-extrabold text-[#111827] truncate">{project.name}</p>
                                            {project.code && (
                                                <span className="bg-[#F3F4F6] text-[#6B7280] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">
                                                    {project.code}
                                                </span>
                                            )}
                                        </div>
                                        {project.description && (
                                            <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{project.description}</p>
                                        )}
                                        <span className="mt-1.5 inline-block bg-[#EEF2FF] text-[#5340FF] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">
                                            {project.categories_count} Carpetas
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={route('categories.index', project.id)}
                                        className="h-9 px-4 flex items-center gap-1.5 bg-[#EEF2FF] hover:bg-indigo-100 text-[#5340FF] text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition whitespace-nowrap"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                        Ver Carpetas
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </AuthenticatedLayout>
    );
}

