import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useConfirm } from '@/Components/ConfirmModal';

export default function Groups({ year, month, schedules, unassignedWorkers, minYear, minMonth, maxYear, maxMonth }) {
    const { confirmModal, askConfirm } = useConfirm();
    // Navigation
    const isPrevMonthDisabled = year < minYear || (year === minYear && month <= minMonth);
    const isNextMonthDisabled = year > maxYear || (year === maxYear && month >= maxMonth);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        name: '',
        color: '#E5E7EB',
        workDays: '',
        restDays: '',
        startDate: '',
        endDate: ''
    });
    const [editingScheduleId, setEditingScheduleId] = useState(null);

    const resetModal = () => {
        setShowScheduleModal(false);
        setEditingScheduleId(null);
        setNewSchedule({ name: '', color: '#E5E7EB', workDays: '', restDays: '', startDate: '', endDate: '' });
    };
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [dragOverSchedule, setDragOverSchedule] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUnassigned = unassignedWorkers.filter(w => {
        if (!searchTerm) return true;
        const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
        const workerData = `${w.nombres} ${w.apellido_paterno} ${w.apellido_materno} ${w.rut || ''} ${w.position || ''}`.toLowerCase();

        return searchWords.every(word => workerData.includes(word));
    });

    const handleSubmitSchedule = () => {
        if (!newSchedule.name) return;

        const payload = {
            year,
            month,
            name: newSchedule.name,
            color: newSchedule.color,
            work_days: newSchedule.workDays,
            rest_days: newSchedule.restDays,
            start_date: newSchedule.startDate || `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: newSchedule.endDate || null
        };

        if (editingScheduleId) {
            router.put(route('shifts.schedules.update', editingScheduleId), payload, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: resetModal
            });
        } else {
            router.post(route('shifts.schedules.store'), payload, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: resetModal
            });
        }
    };

    const handleEditSchedule = (schedule) => {
        setEditingScheduleId(schedule.id);
        setNewSchedule({
            name: schedule.name,
            color: schedule.color,
            workDays: schedule.work_days,
            restDays: schedule.rest_days,
            startDate: schedule.start_date,
            endDate: schedule.end_date || ''
        });
        setShowScheduleModal(true);
    };

    const handleRemoveWorker = (scheduleId, workerId) => {
        askConfirm({
            title: '¿Quitar trabajador del grupo?',
            message: 'Sus turnos en la cuadrícula dejarán de mostrarse para este grupo.',
            variant: 'danger',
            confirmLabel: 'Quitar',
            onConfirm: () => {
                router.delete(route('shifts.schedules.remove', { schedule: scheduleId, worker: workerId }), {
                    preserveState: true,
                    preserveScroll: true,
                });
            }
        });
    };

    const changeMonth = (offset) => {
        if (offset === -1 && isPrevMonthDisabled) return;
        if (offset === 1 && isNextMonthDisabled) return;
        let newMonth = month + offset;
        let newYear = year;
        if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        } else if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        }
        router.get(route('shifts.groups.index', { year: newYear, month: newMonth }));
    };

    // --- Drag and Drop Logic ---
    const toggleSelection = (workerId) => {
        setSelectedWorkers(prev => prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]);
    };

    const handleDragStart = (e, workerId) => {
        let draggingIds = selectedWorkers;
        // If the item being dragged is not in the selection, clear selection and just drag this one
        if (!selectedWorkers.includes(workerId)) {
            draggingIds = [workerId];
            setSelectedWorkers([workerId]);
        }
        e.dataTransfer.setData('worker_ids', JSON.stringify(draggingIds));
        e.dataTransfer.effectAllowed = 'move';

        // Ensure custom visual if dragging multiple (Stack/Hamburger style)
        if (draggingIds.length > 1 && e.dataTransfer.setDragImage) {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.top = '-1000px';
            el.style.left = '-1000px';

            // Create a stack effect (Hamburger mode)
            el.innerHTML = `
                <div style="position: relative; width: 220px;">
                    <div style="position: absolute; top: 8px; left: 8px; width: 100%; height: 44px; background: #EEF2FF; border: 1.5px solid #C7D2FE; border-radius: 12px; z-index: 1;"></div>
                    <div style="position: absolute; top: 4px; left: 4px; width: 100%; height: 44px; background: #E0E7FF; border: 1.5px solid #A5B4FC; border-radius: 12px; z-index: 2;"></div>
                    <div style="position: relative; width: 100%; height: 44px; background: #5340FF; border: 1.5px solid #4330E0; border-radius: 12px; z-index: 3; display: flex; items-center; justify-content: center; color: white; font-family: sans-serif; font-size: 12px; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="display:flex; align-items:center; gap:8px; padding: 0 12px;">
                             <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" /></svg>
                             MOVIENDO ${draggingIds.length} TRABAJADORES
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(el);
            e.dataTransfer.setDragImage(el, 20, 22);
            setTimeout(() => document.body.removeChild(el), 0);
        }
    };

    const handleDrop = (e, scheduleId) => {
        e.preventDefault();
        setDragOverSchedule(null);
        const data = e.dataTransfer.getData('worker_ids');
        if (data) {
            const workerIds = JSON.parse(data);
            if (workerIds.length > 0) {
                router.post(route('shifts.groups.assign', scheduleId), { worker_ids: workerIds }, {
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: () => setSelectedWorkers([])
                });
            }
        }
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">Administrar Grupos de Turnos</h2>
                        <p className="text-[14px] text-[#6B7280] mt-1">Crea los bloques de turnos y asigna el personal arrastrando.</p>
                    </div>

                    <div className="flex items-center gap-4">

                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="flex items-center gap-2 bg-[#5340FF] hover:bg-[#4330E0] text-white px-4 py-2 rounded-xl text-[13px] font-bold tracking-wide transition shadow-sm shadow-indigo-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Crear Grupo
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Grupos de Turnos" />

            <div className="flex flex-col lg:flex-row gap-6 mt-2">

                {/* Panel Trabajadores Sin Asignar */}
                <div className="w-full lg:w-1/3 xl:w-1/4 bg-white rounded-2xl shadow-sm border border-[#EAECF0] flex flex-col h-[75vh] sticky top-6">
                    <div className="p-4 border-b border-[#EAECF0] bg-[#F9FAFB] rounded-t-2xl flex items-center justify-between">
                        <h3 className="text-[14px] font-bold text-[#111827]">Sin Asignar ({unassignedWorkers.length})</h3>
                        {selectedWorkers.length > 0 && (
                            <span className="bg-[#5340FF] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                                {selectedWorkers.length} selec.
                            </span>
                        )}
                    </div>

                    {/* Buscador de Trabajadores */}
                    <div className="p-3 border-b border-[#EAECF0]">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o RUT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-9 pr-4 text-[12px] font-medium border border-[#EAECF0] rounded-xl focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all bg-[#F9FAFB] group-hover:bg-white"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 overflow-y-auto flex-1 space-y-2">
                        {filteredUnassigned.length === 0 ? (
                            <p className="text-center text-[#9CA3AF] text-[13px] mt-6 italic">
                                {searchTerm ? 'No se encontraron coincidencias.' : 'No hay trabajadores sin asignar.'}
                            </p>
                        ) : (
                            filteredUnassigned.map(w => {
                                const isSelected = selectedWorkers.includes(w.id);
                                return (
                                    <div
                                        key={w.id}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, w.id)}
                                        onClick={() => toggleSelection(w.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'bg-indigo-50 border-[#5340FF] shadow-sm' : 'bg-white border-[#EAECF0] hover:border-gray-300'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-[#5340FF] border-[#5340FF]' : 'border-gray-300 bg-white'
                                            }`}>
                                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div className="truncate pointer-events-none">
                                            <p className={`text-[13px] font-bold truncate ${isSelected ? 'text-[#4330E0]' : 'text-[#374151]'}`}>
                                                {w.nombres} {w.apellido_paterno}
                                            </p>
                                            <p className="text-[11px] text-[#9CA3AF] truncate">{w.rut}</p>
                                        </div>
                                        <div className="ml-auto text-gray-300 pointer-events-none">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {/* Helper text */}
                    <div className="p-3 border-t border-[#EAECF0] bg-gray-50 rounded-b-2xl">
                        <p className="text-[11px] text-[#6B7280] leading-tight text-center">
                            <strong>Selecciona múltiples</strong> trabajadores y <strong>arrástralos</strong> hacia los grupos a la derecha.
                        </p>
                    </div>
                </div>

                {/* Panel Grupos */}
                <div className="w-full lg:w-2/3 xl:w-3/4 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start content-start">
                    {schedules.map(schedule => (
                        <div
                            key={schedule.id}
                            onDragOver={(e) => { e.preventDefault(); setDragOverSchedule(schedule.id); }}
                            onDragLeave={() => setDragOverSchedule(null)}
                            onDrop={(e) => handleDrop(e, schedule.id)}
                            className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all ${dragOverSchedule === schedule.id ? 'border-[#5340FF] ring-2 ring-[#5340FF]/20 scale-[1.02]' : 'border-[#EAECF0]'
                                }`}
                        >
                            <div className="p-4 border-b border-[#EAECF0] flex items-center justify-between" style={{ borderTop: `4px solid ${schedule.color}` }}>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: schedule.color }}></div>
                                        <h3 className="text-[15px] font-bold text-[#111827] truncate max-w-[120px]">{schedule.name}</h3>
                                        <span className="text-[10px] font-mono bg-[#F3F4F6] text-[#6B7280] px-2 py-[2px] rounded-full border border-[#E5E7EB]">
                                            {schedule.work_days}x{schedule.rest_days}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-7 text-[10px] text-[#6B7280] font-medium">
                                        <svg className="w-3 h-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>Inicio: <span className="text-[#374151] font-bold">{new Date(schedule.start_date + 'T00:00:00').toLocaleDateString('es-CL')}</span></span>
                                        {schedule.end_date && (
                                            <>
                                                <span className="mx-1">•</span>
                                                <span>Fin: <span className="text-[#374151] font-bold">{new Date(schedule.end_date + 'T00:00:00').toLocaleDateString('es-CL')}</span></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-100 shadow-sm ml-2">
                                    <button
                                        onClick={() => handleEditSchedule(schedule)}
                                        className="text-[#6B7280] hover:text-[#5340FF] p-1.5 rounded-md hover:bg-white hover:shadow-sm transition"
                                        title="Editar"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <div className="w-[1px] bg-gray-200 my-1 mx-0.5"></div>
                                    <button
                                        onClick={() => {
                                            askConfirm({
                                                title: '¿Eliminar grupo por completo?',
                                                message: 'Se perderán todas las asignaciones de trabajadores asociadas a este grupo.',
                                                variant: 'danger',
                                                confirmLabel: 'Eliminar',
                                                onConfirm: () => router.delete(route('shifts.schedules.destroy', schedule.id))
                                            });
                                        }}
                                        className="text-[#9CA3AF] hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition"
                                        title="Eliminar"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-[#F9FAFB] border-b border-[#EAECF0]">
                                <h4 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider text-center flex items-center justify-center gap-2">
                                    Trabajadores Asignados
                                    <span className="bg-[#E5E7EB] text-[#4B5563] px-2 py-0.5 rounded-full text-[10px]">{schedule.workers?.length || 0}</span>
                                </h4>
                            </div>

                            <div className="p-3 flex-1 min-h-[120px] max-h-[250px] overflow-y-auto">
                                {(!schedule.workers || schedule.workers.length === 0) ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-50 p-4">
                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                        <span className="text-[12px] text-center text-gray-500 font-medium">Arrastra trabajadores aquí</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {schedule.workers.map(w => {
                                            const isSelected = selectedWorkers.includes(w.id);
                                            return (
                                                <div
                                                    key={w.id}
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(e, w.id)}
                                                    onClick={() => toggleSelection(w.id)}
                                                    className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'bg-indigo-50 border-[#5340FF] shadow-sm' : 'bg-white border-[#EAECF0] hover:border-[#D1D5DB]'}`}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                                                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-[#5340FF] border border-[#5340FF]' : 'border border-gray-300 bg-white'}`}>
                                                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className={`text-[12px] font-bold truncate ${isSelected ? 'text-[#4330E0]' : 'text-[#374151]'}`}>{w.nombres} {w.apellido_paterno}</p>
                                                            <p className="text-[10px] text-[#9CA3AF] truncate leading-tight mt-0.5">{w.position || 'Sin cargo'}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveWorker(schedule.id, w.id); }}
                                                        className="text-gray-300 hover:text-red-500 transition p-1 hover:bg-red-50 rounded shrink-0"
                                                        title="Quitar"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {schedules.length === 0 && (
                        <div className="col-span-1 xl:col-span-2 2xl:col-span-3 border-2 border-dashed border-[#EAECF0] rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4 text-[#9CA3AF]">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </div>
                            <h3 className="text-[16px] font-bold text-[#374151] mb-1">Aún no hay grupos de turnos</h3>
                            <p className="text-[13px] text-[#6B7280] max-w-sm mb-4">Crea tu primer grupo para poder empezar a arrastrar y asignar a tus trabajadores.</p>
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#111827] px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm"
                            >
                                Crear Primer Grupo
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Crear Grupo */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-[#EAECF0]">
                            <h3 className="text-[18px] font-extrabold text-[#111827]">{editingScheduleId ? 'Editar Grupo de Turno' : 'Crear Grupo de Turno'}</h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Nombre del Turno (Ej: Turno A, Logística)</label>
                                    <input
                                        type="text"
                                        className="w-full text-[14px] px-3 py-2 border border-[#D1D5DB] rounded-xl focus:ring-[#5340FF] focus:border-[#5340FF]"
                                        value={newSchedule.name}
                                        onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })}
                                        placeholder="Ingrese el nombre"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Fecha de Inicio del Patrón de Turno</label>
                                    <input
                                        type="date"
                                        className="w-full text-[14px] px-3 py-2 border border-[#D1D5DB] rounded-xl focus:ring-[#5340FF] focus:border-[#5340FF]"
                                        value={newSchedule.startDate || `${year}-${String(month).padStart(2, '0')}-01`}
                                        onChange={e => setNewSchedule({ ...newSchedule, startDate: e.target.value })}
                                    />
                                    <p className="mt-1 text-[11px] text-[#9CA3AF]">Define el día 1 en el que iniciará a contar el ciclo.</p>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Fecha de Término (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full text-[14px] px-3 py-2 border border-[#D1D5DB] rounded-xl focus:ring-[#5340FF] focus:border-[#5340FF]"
                                        value={newSchedule.endDate}
                                        onChange={e => setNewSchedule({ ...newSchedule, endDate: e.target.value })}
                                        min={newSchedule.startDate || `${year}-${String(month).padStart(2, '0')}-01`}
                                    />
                                    <p className="mt-1 text-[11px] text-[#9CA3AF]">Define cuándo finaliza este grupo (dejalo en blanco si es infinito).</p>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Color Identificativo</label>
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {['#FBBF24', '#34D399', '#60A5FA', '#818CF8', '#A78BFA', '#F472B6', '#F87171', '#9CA3AF'].map(color => (
                                            <button
                                                key={color}
                                                className={`w-8 h-8 rounded-full border-2 focus:outline-none transition-transform ${newSchedule.color === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-110'}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setNewSchedule({ ...newSchedule, color })}
                                            ></button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] font-bold text-[#374151] mb-1.5 shrink-0 text-yellow-600">Días Trabajo (x)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full text-[14px] px-3 py-2 border border-[#D1D5DB] rounded-xl focus:ring-[#5340FF] focus:border-[#5340FF] bg-yellow-50"
                                            value={newSchedule.workDays}
                                            onChange={e => setNewSchedule({ ...newSchedule, workDays: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                            placeholder="Ej: 14"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[12px] font-bold text-[#374151] mb-1.5 shrink-0 text-red-600">Días Descanso (y)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full text-[14px] px-3 py-2 border border-[#D1D5DB] rounded-xl focus:ring-[#5340FF] focus:border-[#5340FF] bg-red-50"
                                            value={newSchedule.restDays}
                                            onChange={e => setNewSchedule({ ...newSchedule, restDays: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                            placeholder="Ej: 14"
                                        />
                                    </div>
                                    <p className="col-span-2 text-[11px] text-[#9CA3AF] leading-tight">
                                        Al asignar un trabajador a este grupo se llenará un patrón recurrente de <strong>{newSchedule.workDays}</strong> días de trabajo seguidos de <strong>{newSchedule.restDays}</strong> días de descanso.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={resetModal} className="px-4 py-2 text-[13px] font-bold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmitSchedule}
                                    disabled={!newSchedule.name || newSchedule.workDays === '' || newSchedule.restDays === ''}
                                    className="px-4 py-2 text-[13px] font-bold text-white bg-[#5340FF] hover:bg-[#4330E0] rounded-xl transition disabled:opacity-50"
                                >
                                    {editingScheduleId ? 'Guardar Cambios' : 'Guardar Grupo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal Render */}
            {confirmModal}
        </AuthenticatedLayout>
    );
}
