import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

export default function PhoneDirectory({ auth, workers }) {
    const [search, setSearch] = useState('');

    const filteredWorkers = workers.filter(worker =>
        worker.nombres.toLowerCase().includes(search.toLowerCase()) ||
        worker.apellido_paterno.toLowerCase().includes(search.toLowerCase()) ||
        worker.apellido_materno.toLowerCase().includes(search.toLowerCase()) ||
        (worker.rut && worker.rut.includes(search)) ||
        (worker.pasaporte && worker.pasaporte.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Agenda Telefónica</h2>}
        >
            <Head title="Agenda Telefónica" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100">
                        {/* HEADER */}
                        <div className="px-8 py-8 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h1 className="text-2xl font-black text-[#111827] tracking-tight">Directorio Personal</h1>
                                    <p className="mt-1 text-sm text-[#6B7280] font-medium">Consulta rápida de contactos y emergencias</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Buscar contacto..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="w-full md:w-80 h-11 pl-11 pr-5 rounded-xl border border-[#EAECF0] bg-white text-[14px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] transition-all outline-none"
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#F9FAFB]/80 border-b border-[#EAECF0]">
                                        <th className="px-8 py-4 text-[11px] font-black text-[#6B7280] uppercase tracking-[0.15em]">Trabajador</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-[#6B7280] uppercase tracking-[0.15em]">Identificación</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-[#6B7280] uppercase tracking-[0.15em]">Contacto</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-[#6B7280] uppercase tracking-[0.15em]">Emergencia</th>
                                        <th className="px-8 py-4 text-[11px] font-black text-[#6B7280] uppercase tracking-[0.15em] text-center w-20">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredWorkers.map(worker => (
                                        <tr key={worker.id} className="hover:bg-gray-50/80 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5340FF] to-[#7C6DFF] flex items-center justify-center text-white text-[13px] font-black shadow-lg shadow-indigo-100 ring-4 ring-indigo-50/50">
                                                        {worker.nombres.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-bold text-[#111827] line-tight capitalize">
                                                            {worker.nombres}
                                                        </p>
                                                        <p className="text-[12px] text-[#6B7280] mt-0.5 capitalize">
                                                            {worker.apellido_paterno} {worker.apellido_materno}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] text-[11px] font-black tracking-tight">
                                                    {worker.nacionalidad === 'Chilena' ? `RUT: ${worker.rut}` : `PAS: ${worker.pasaporte}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 group/phone">
                                                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 transition-colors group-hover/phone:bg-blue-600 group-hover/phone:text-white">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                        </div>
                                                        <span className="text-[13px] font-bold text-[#4B5563]">{worker.phone}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 group/wa">
                                                        <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 transition-colors group-hover/wa:bg-emerald-600 group-hover/wa:text-white">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                        </div>
                                                        <span className="text-[13px] font-bold text-[#4B5563]">{worker.whatsapp || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100/50">
                                                    <p className="text-[12px] font-black text-[#9A3412] uppercase tracking-wider">{worker.emergencia_contacto_nombre}</p>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[#C2410C]">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        <span className="text-[13px] font-bold tracking-tight">{worker.emergencia_contacto_numero}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <Link
                                                    href={route('workers.index', { id: worker.id })}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-[#6B7280] hover:bg-[#5340FF] hover:text-white transition-all shadow-sm"
                                                    title="Editar ficha"
                                                >
                                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredWorkers.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354l1.1.63a2 2 0 002.2 0l1.1-.63a2 2 0 011.8.1l1.1.63a2 2 0 011 1.74l1.1 1.9a2 2 0 01-1.8 3.1l-1.1.63a2 2 0 00-1 1.73v1.26a2 2 0 01-1.8 1.9l-1.1.1a2 2 0 01-1.8-1.9v-1.26a2 2 0 00-1-1.73l-1.1-.63a2 2 0 01-1.8-3.1l1.1-1.9a2 2 0 011-1.74l1.1-.63a2 2 0 011.8-.1z" /></svg>
                                                    </div>
                                                    <p className="text-gray-500 font-bold text-sm">No se encontraron contactos</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
