import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

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

export default function Dashboard() {
    const { props } = usePage();
    const user = props.auth.user;
    const stats = props.stats ?? { projects: 0, workers: 0, courses: 0, documents: 0 };
    const recentProjects = props.recentProjects ?? [];

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
