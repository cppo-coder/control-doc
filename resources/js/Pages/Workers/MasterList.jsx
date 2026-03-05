import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { useConfirm } from '@/Components/ConfirmModal';

export default function MasterList({ auth, workers, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { confirmModal, askConfirm } = useConfirm();

    // Server side filtered via workers.data
    const filteredWorkers = workers.data;

    const handleDelete = (id) => {
        askConfirm({
            title: '¿Eliminar trabajador?',
            message: '¿Estás seguro de que deseas eliminar este trabajador? Todos sus registros asociados se verán afectados.',
            variant: 'danger',
            confirmLabel: 'Sí, eliminar',
            onConfirm: () => {
                router.delete(route('workers.destroy', id), {
                    onSuccess: () => showToast('Trabajador eliminado con éxito'),
                    onError: () => showToast('Hubo un error al eliminar', 'error')
                });
            }
        });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">Listado Maestro de Personal</h2>
                        <p className="text-[13px] text-[#6B7280] font-medium mt-1">Gestión centralizada de todos los trabajadores registrados.</p>
                    </div>
                    <Link
                        href={route('workers.index')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5340FF] text-white rounded-xl text-[13px] font-bold shadow-lg shadow-indigo-100 hover:bg-[#4534D9] transition-all transform hover:-translate-y-0.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Registrar Nuevo
                    </Link>
                </div>
            }
        >
            <Head title="Listado Maestro" />
            {confirmModal}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-500 transform translate-y-0
                    ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-100 text-red-800'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {toast.type === 'success' ? (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                    </div>
                    <span className="text-[13px] font-bold">{toast.message}</span>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-[#EAECF0] shadow-sm overflow-hidden">
                {/* Filters / Search */}
                <div className="p-6 border-b border-[#EAECF0] flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, RUT o pasaporte..."
                            className="block w-full pl-11 pr-4 py-2.5 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-[13px] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all outline-none"
                            value={search}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearch(val);
                                router.get(route('workers.master-list'), { search: val }, {
                                    preserveState: true,
                                    replace: true
                                });
                            }}
                        />
                    </div>
                    <div className="text-[12px] font-semibold text-[#6B7280]">
                        Mostrando {workers.from}-{workers.to} de {workers.total} trabajadores
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#F9FAFB]">
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Trabajador</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Identificación</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Cargo / Depto</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Contacto</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAECF0]">
                            {filteredWorkers.length > 0 ? (
                                filteredWorkers.map((worker) => (
                                    <tr key={worker.id} className="hover:bg-[#F9FAFB] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center font-bold text-[#5340FF] text-[13px] shrink-0 shadow-sm">
                                                    {worker.nombres.charAt(0)}{worker.apellido_paterno.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-bold text-[#111827]">
                                                        {worker.nombres}
                                                    </p>
                                                    <p className="text-[12px] text-[#6B7280]">
                                                        {worker.apellido_paterno} {worker.apellido_materno}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#F3F4F8] text-[#374151] border border-[#EAECF0]">
                                                <span className="text-[11px] font-bold tracking-tight">
                                                    {worker.rut ? `RUT: ${worker.rut}` : (worker.pasaporte ? `PAS: ${worker.pasaporte}` : 'S/I')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[13px] font-semibold text-[#374151] leading-tight">
                                                {worker.position || 'No asignado'}
                                            </p>
                                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                                                {worker.department || 'Sin depto'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 group/link">
                                                    <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    <span className="text-[12px] text-[#6B7280]">{worker.email}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    <span className="text-[12px] text-[#6B7280]">{worker.phone}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                                                ${worker.is_active !== false ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                {worker.is_active !== false ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => router.get(route('workers.index', { id: worker.id }))}
                                                    className="p-2 text-[#9CA3AF] hover:text-[#5340FF] hover:bg-[#EEF2FF] rounded-lg transition-colors"
                                                    title="Editar Ficha"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(worker.id)}
                                                    className="p-2 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-[#F3F4F8] rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                            </div>
                                            <p className="text-[15px] font-bold text-[#374151]">No se encontraron trabajadores</p>
                                            <p className="text-[13px] text-[#6B7280] mt-1">Intenta con otros términos de búsqueda.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination Placeholder */}
                {/* Pagination */}
                <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {workers.links.map((link, i) => (
                            !link.url ? (
                                <span
                                    key={i}
                                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-[12px] font-bold transition-all text-[#9CA3AF] cursor-not-allowed opacity-50`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <Link
                                    key={i}
                                    href={link.url}
                                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-[12px] font-bold transition-all
                                        ${link.active
                                            ? 'bg-[#5340FF] text-white shadow-md'
                                            : 'text-[#6B7280] hover:bg-white hover:text-[#5340FF] border border-transparent hover:border-[#EAECF0]'
                                        }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            )
                        ))}
                    </div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                        Sistema de Control Documental • Personal
                    </p>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
