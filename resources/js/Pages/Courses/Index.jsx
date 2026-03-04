import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useMemo } from 'react';

export default function Index({ courses, workers }) {
    const { data, setData, post, patch, processing, errors, reset, delete: destroy } = useForm({
        id: null,
        worker_id: null,
        nombre_curso: '',
        fecha_realizacion: '',
    });

    const [isEditing, setIsEditing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter courses based on search query
    const filteredCourses = useMemo(() => {
        return courses.filter(course => {
            const searchStr = searchQuery.toLowerCase();
            const workerName = course.worker
                ? `${course.worker.nombres} ${course.worker.apellido_paterno}`.toLowerCase()
                : 'sin trabajador';
            const courseName = course.nombre_curso.toLowerCase();
            const idDoc = course.worker
                ? (course.worker.rut || course.worker.pasaporte || '').toLowerCase()
                : '';

            return workerName.includes(searchStr) ||
                courseName.includes(searchStr) ||
                idDoc.includes(searchStr);
        });
    }, [courses, searchQuery]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            patch(route('courses.update', data.id), {
                onSuccess: () => {
                    closeModal();
                },
            });
        } else {
            post(route('courses.store'), {
                onSuccess: () => {
                    closeModal();
                },
            });
        }
    };

    const editCourse = (course) => {
        setData({
            id: course.id,
            worker_id: course.worker_id,
            nombre_curso: course.nombre_curso,
            fecha_realizacion: course.fecha_realizacion,
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setIsEditing(false);
        reset();
    };

    const deleteCourse = (id) => {
        if (confirm('¿Estás seguro de eliminar este registro de curso?')) {
            destroy(route('courses.destroy', id));
        }
    };

    // Helper to format date nicely (Chilean format DD/MM/YYYY)
    // We use split to avoid the common new Date() timezone shift bug
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-[28px] font-black text-[#111827] tracking-tight">Gestión de Cursos</h2>
                        <p className="text-[14px] text-[#6B7280] font-medium mt-1">Control de capacitaciones por trabajador</p>
                    </div>
                    <button
                        onClick={() => {
                            reset();
                            setIsEditing(false);
                            setShowModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2.5 px-6 h-12 bg-[#5340FF] text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-[#4534E0] hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Registrar Curso
                    </button>
                </div>
            }
        >
            <Head title="Cursos de Capacitación" />

            <div className="space-y-6">
                {/* Search and Filters bar */}
                <div className="bg-white p-4 rounded-[20px] border border-[#EAECF0] shadow-sm flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:max-w-md">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por trabajador, curso o RUT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 pl-12 pr-4 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-[14px] font-medium text-[#111827] focus:ring-4 focus:ring-[#5340FF]/5 focus:border-[#5340FF] focus:bg-white transition-all outline-none"
                        />
                    </div>
                    <div className="ml-auto text-[13px] font-semibold text-[#6B7280]">
                        Mostrando <span className="text-[#111827] font-black">{filteredCourses.length}</span> resultados
                    </div>
                </div>

                <div className="bg-white rounded-[24px] border border-[#EAECF0] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#EAECF0] bg-[#F9FAFB]/50">
                                    <th className="px-8 py-5 text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em]">Trabajador</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em]">Curso Realizado</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em]">Fecha</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAECF0]">
                                {filteredCourses.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-24 text-center">
                                            <div className="max-w-xs mx-auto flex flex-col items-center gap-4">
                                                <div className="w-20 h-20 bg-[#F9FAFB] rounded-3xl flex items-center justify-center border-2 border-dashed border-[#EAECF0]">
                                                    <svg className="w-10 h-10 text-[#D0D5DD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-[16px] font-black text-[#111827]">Sin resultados</h4>
                                                    <p className="text-[13px] text-[#6B7280] font-medium">No encontramos cursos que coincidan con tu búsqueda.</p>
                                                </div>
                                                {searchQuery && (
                                                    <button
                                                        onClick={() => setSearchQuery('')}
                                                        className="text-[13px] font-bold text-[#5340FF] hover:underline"
                                                    >
                                                        Limpiar búsqueda
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCourses.map((course) => {
                                        return (
                                            <tr key={course.id} className="group hover:bg-[#F9FAFB]/80 transition-all duration-200">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-[#EAECF0] flex items-center justify-center bg-gradient-to-br from-white to-[#F9FAFB] border border-[#EAECF0] text-[12px] font-black text-[#111827] shadow-sm">
                                                            {course.worker ? (
                                                                `${course.worker.nombres.charAt(0)}${course.worker.apellido_paterno.charAt(0)}`
                                                            ) : '—'}
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-bold text-[#111827] leading-none mb-1">
                                                                {course.worker ? `${course.worker.nombres} ${course.worker.apellido_paterno}` : 'Sin trabajador'}
                                                            </p>
                                                            <p className="text-[12px] text-[#6B7280] font-medium">
                                                                {course.worker ? (course.worker.rut || course.worker.pasaporte) : 'No asignado'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#5340FF]/20 flex items-center justify-center">
                                                            <div className="w-1 h-1 rounded-full bg-[#5340FF]"></div>
                                                        </div>
                                                        <p className="text-[14px] font-bold text-[#111827]">{course.nombre_curso}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <p className="text-[14px] font-black text-[#374151]">
                                                        {formatDate(course.fecha_realizacion)}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                editCourse(course);
                                                            }}
                                                            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl bg-white border border-[#EAECF0] text-[#6B7280] hover:text-[#5340FF] hover:border-[#5340FF] hover:shadow-lg hover:shadow-indigo-50 transition-all duration-200"
                                                            title="Editar registro"
                                                        >
                                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteCourse(course.id);
                                                            }}
                                                            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl bg-white border border-[#EAECF0] text-[#6B7280] hover:text-red-500 hover:border-red-500 hover:shadow-lg hover:shadow-red-50 transition-all duration-200"
                                                            title="Eliminar registro"
                                                        >
                                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal - Compact Premium Design */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0B0F19]/60 backdrop-blur-[4px] transition-all duration-300" onClick={closeModal}></div>
                    <div className="relative bg-white w-full max-w-[440px] rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="px-7 pt-7 pb-5 border-b border-[#EAECF0]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-indigo-50 rounded-xl">
                                    <svg className="w-5 h-5 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4" />
                                    </svg>
                                </div>
                                <button onClick={closeModal} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors">
                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <h3 className="text-[20px] font-black text-[#111827] tracking-tight">{isEditing ? 'Editar Registro' : 'Nueva Capacitación'}</h3>
                            <p className="text-[13px] text-[#6B7280] font-medium mt-1">Ingresa los datos del curso realizado.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="bg-white">
                            <div className="px-7 py-7 space-y-6">

                                {/* Nombre Curso */}
                                <div>
                                    <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.2em] mb-2.5 ml-1">Detalles del Curso</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Nombre de la capacitación"
                                        value={data.nombre_curso}
                                        onChange={e => setData('nombre_curso', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm"
                                    />
                                    {errors.nombre_curso && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.nombre_curso}</p>}
                                </div>

                                {/* Fecha Realización */}
                                <div>
                                    <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.2em] mb-2.5 ml-1">Fecha de Ejecución</label>
                                    <input
                                        type="date"
                                        required
                                        value={data.fecha_realizacion}
                                        onChange={e => setData('fecha_realizacion', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm"
                                    />
                                    {errors.fecha_realizacion && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.fecha_realizacion}</p>}
                                </div>
                            </div>

                            <div className="px-7 py-6 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-6 h-11 rounded-xl text-[13px] font-extrabold text-[#6B7280] hover:bg-[#F3F4F6] transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-8 h-11 rounded-xl bg-[#5340FF] text-[13px] font-black text-white shadow-lg shadow-indigo-100 hover:bg-[#4534E0] hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0 disabled:opacity-50"
                                >
                                    {processing ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Registrar Curso')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
