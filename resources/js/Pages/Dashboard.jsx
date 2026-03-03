import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';

export default function Dashboard() {
    const user = usePage().props.auth.user;

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
                    {[
                        { label: 'Proyectos Activos', value: '12', trend: '+2 nuevos', color: 'bg-blue-600', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
                        { label: 'Documentos Hoy', value: '148', trend: '+12% vs ayer', color: 'bg-emerald-500', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                        { label: 'Alertas IA', value: '3', trend: 'Requiere atención', color: 'bg-rose-500', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
                        { label: 'Almacenamiento', value: '82%', trend: 'Google Drive', color: 'bg-amber-500', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-[24px] border border-[#EAECF0] shadow-sm hover:shadow-md transition cursor-default group">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                                    </svg>
                                </div>
                                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{stat.trend}</span>
                            </div>
                            <p className="text-[13px] font-bold text-[#6B7280] mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-[#111827]">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-[#EAECF0] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-[#EAECF0] flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-[#111827]">Actividad Reciente</h3>
                            <button className="text-[12px] font-bold text-[#5340FF] hover:underline transition">Ver Todo</button>
                        </div>
                        <div className="p-8 space-y-6">
                            {[
                                { user: 'Admin', action: 'subió 120 documentos', project: 'Faena Los Bronces', time: 'hace 5 min' },
                                { user: 'IA Gemini', action: 'validó 45 exámenes', project: 'Proyecto Solar Atacama', time: 'hace 12 min' },
                                { user: 'Sistema', action: 'creó nueva carpeta', project: 'Rendiciones v2', time: 'hace 1 hora' },
                            ].map((item, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#F3F4F8] flex items-center justify-center shrink-0">
                                        <span className="text-[11px] font-bold text-[#6B7280]">{item.user.charAt(0)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[14px] text-[#374151]">
                                            <span className="font-bold text-[#111827]">{item.user}</span> {item.action} en <span className="font-bold text-[#5340FF]">{item.project}</span>
                                        </p>
                                        <p className="text-[12px] text-[#9CA3AF] mt-0.5">{item.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats or empty space */}
                    <div className="bg-white rounded-[32px] p-8 border border-[#EAECF0] shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-[#EEF2FF] rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-[16px] font-black text-[#111827] mb-2">Procesamiento IA</h3>
                        <p className="text-[13px] text-[#6B7280] leading-relaxed">Todos los documentos subidos son analizados automáticamente para detectar alertas críticas.</p>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
