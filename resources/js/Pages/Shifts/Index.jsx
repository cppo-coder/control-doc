import React, { useState, useMemo, useRef, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, Link } from '@inertiajs/react';

const SHIFT_TYPES = [
    { id: 'trabajo', label: 'Trabajo', color: 'bg-[#A78BFA] text-white' }, // Morado
    { id: 'descanso', label: 'Descanso', color: 'bg-[#10B981] text-white' }, // Verde
    { id: 'licencia_medica', label: 'Licencia Médica', color: 'bg-[#EF4444] text-white' }, // Rojo
    { id: 'permiso', label: 'Permiso', color: 'bg-[#93C5FD] text-[#1E3A8A]' }, // Celeste
    { id: 'inicio_contrato', label: 'Inicio Contrato', color: 'bg-[#047857] text-white' },
    { id: 'finiquitado', label: 'Finiquitado', color: 'bg-[#111827] text-white' },
    { id: 'clear', label: 'Limpiar (Vacío)', color: 'bg-white border-2 border-dashed border-gray-300 text-gray-500' },
];

export default function ShiftsIndex({
    year,
    month,
    monthsData = [],
    schedules,
    shiftDays,
    minYear,
    minMonth,
    maxYear,
    maxMonth,
}) {
    // Basic navigation
    const isPrevMonthDisabled = year < minYear || (year === minYear && month <= minMonth);
    const isNextMonthDisabled = year > maxYear || (year === maxYear && month >= maxMonth);

    const navigateMonth = (offset) => {
        if (offset === -1 && isPrevMonthDisabled) return;
        if (offset === 1 && isNextMonthDisabled) return;
        let y = year;
        let m = month + offset;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        router.get(route('shifts.index'), { year: y, month: m }, { preserveState: true });
    };

    // State for local modifications
    const [localChanges, setLocalChanges] = useState({});
    const [localNotes, setLocalNotes] = useState({});
    const [saving, setSaving] = useState(false);

    // Custom mouse-based worker drag
    const dragWorkerRef = React.useRef(null);
    const [dragState, setDragState] = useState(null); // { workerId, workerName, x, y, targetScheduleId }

    // Custom mouse-based schedule reorder drag
    const dragScheduleRef = React.useRef(null);
    const [scheduleDragState, setScheduleDragState] = useState(null); // { scheduleId, scheduleName, x, y, targetScheduleId }

    // UI Context Menu and Selection
    const [activeCell, setActiveCell] = useState(null); // { x, y, cells: [{scheduleId, workerId, day}] }
    const [hoveredNote, setHoveredNote] = useState(null); // { x, y, note }
    const [moveConfirm, setMoveConfirm] = useState(null); // { workerId, workerName, targetScheduleId, targetScheduleName, date: 'YYYY-MM-DD' }

    // Scroll container ref for date tracking
    const scrollContainerRef = useRef(null);
    const [visibleDate, setVisibleDate] = useState(null); // { day, month, year, label }

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionCurrent, setSelectionCurrent] = useState(null);
    const [selectedCells, setSelectedCells] = useState([]);

    const allDaysArray = useMemo(() => {
        const days = [];
        monthsData.forEach(m => {
            for (let i = 1; i <= m.daysInMonth; i++) {
                days.push({ day: i, month: m.month, year: m.year });
            }
        });
        return days;
    }, [monthsData]);

    const getDayName = (day, m, y) => {
        const d = new Date(y, m - 1, day);
        const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
        return days[d.getDay()];
    };

    // Calculate the dynamic base pattern for a cell
    const getBaseCellType = (schedule, dateStr) => {
        if (!schedule.start_date || dateStr < schedule.start_date) return null;
        if (schedule.end_date && dateStr > schedule.end_date) return null;

        const sTime = new Date(`${schedule.start_date}T00:00:00`).getTime();
        const cTime = new Date(`${dateStr}T00:00:00`).getTime();
        const diffInDays = Math.floor((cTime - sTime) / (1000 * 60 * 60 * 24));
        if (diffInDays < 0) return null;

        const totalCycle = schedule.work_days + schedule.rest_days;
        if (totalCycle === 0) return null;

        const iteration = ((diffInDays % totalCycle) + totalCycle) % totalCycle;
        return iteration < schedule.work_days ? 'trabajo' : 'descanso';
    };

    // Build grid data
    const getCellType = (scheduleId, workerId, day, m, y) => {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${scheduleId}_${workerId}_${dateStr}`;
        if (localChanges[key] !== undefined) {
            return localChanges[key] === 'clear' ? null : localChanges[key];
        }
        const existing = shiftDays.find(d => String(d.shift_schedule_id) === String(scheduleId) && String(d.worker_id) === String(workerId) && d.date.startsWith(dateStr));
        if (existing && existing.type) {
            return existing.type === 'clear' ? null : existing.type;
        }

        const schedule = schedules.find(s => String(s.id) === String(scheduleId));
        return schedule ? getBaseCellType(schedule, dateStr) : null;
    };

    const getCellNote = (scheduleId, workerId, day, m, y) => {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${scheduleId}_${workerId}_${dateStr}`;
        if (localNotes[key] !== undefined) {
            return localNotes[key];
        }
        const existing = shiftDays.find(d => String(d.shift_schedule_id) === String(scheduleId) && String(d.worker_id) === String(workerId) && d.date.startsWith(dateStr));
        return existing ? existing.note : null;
    };

    const handleSelectType = (typeId) => {
        if (!activeCell || !activeCell.cells) return;

        const updates = {};
        activeCell.cells.forEach(cell => {
            const { scheduleId, workerId, day, m, y } = cell;
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const key = `${scheduleId}_${workerId}_${dateStr}`;
            updates[key] = typeId;
        });

        const newChanges = { ...updates };
        setLocalChanges(prev => ({ ...prev, ...updates }));
        setActiveCell(null);
        setSelectedCells([]);

        // Auto-save instantly
        saveToServer(newChanges, localNotes);
    };

    const saveToServer = (currentChanges = localChanges, currentNotes = localNotes) => {
        const allKeys = [...new Set([...Object.keys(currentChanges), ...Object.keys(currentNotes)])];
        if (allKeys.length === 0) return;
        setSaving(true);
        const payload = allKeys.map(key => {
            const [scheduleId, workerId, dateStr] = key.split('_');

            const existing = shiftDays.find(d =>
                String(d.shift_schedule_id) === String(scheduleId) &&
                String(d.worker_id) === String(workerId) &&
                d.date.startsWith(dateStr)
            );

            let finalType = existing ? existing.type : null;
            if (currentChanges[key] !== undefined) {
                finalType = currentChanges[key];
            }

            let finalNote = existing ? existing.note : null;
            if (currentNotes[key] !== undefined) {
                finalNote = currentNotes[key];
            }

            if (currentChanges[key] === 'clear') {
                finalType = 'clear';
            }

            return {
                shift_schedule_id: scheduleId,
                worker_id: workerId,
                date: dateStr,
                type: finalType,
                note: finalNote
            };
        });

        router.post(route('shifts.days.update'), { days: payload }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setLocalChanges({});
                setLocalNotes({});
                setSaving(false);
            },
            onError: () => setSaving(false)
        });
    };

    const saveChanges = () => {
        saveToServer(localChanges, localNotes);
    };

    // --- Custom Mouse Drag for Worker Reordering ---
    const startWorkerDrag = (e, workerId, workerName) => {
        e.preventDefault();
        e.stopPropagation();

        let currentX = e.clientX;
        let currentY = e.clientY;
        let scrollInterval = null;

        const updateTargetUnderMouse = (x, y) => {
            const els = document.elementsFromPoint(x, y);
            const hit = els.find(el => el.dataset && el.dataset.scheduleId);
            setDragState(prev => prev ? { ...prev, x, y, targetScheduleId: hit ? hit.dataset.scheduleId : null } : null);
        };

        dragWorkerRef.current = workerId;
        setDragState({ workerId, workerName, x: currentX, y: currentY, targetScheduleId: null });

        const onMove = (ev) => {
            currentX = ev.clientX;
            currentY = ev.clientY;

            // Auto-scroll logic
            const scrollThreshold = 100;
            const scrollSpeed = 15;

            if (scrollInterval) clearInterval(scrollInterval);

            if (currentY < scrollThreshold || currentY > window.innerHeight - scrollThreshold) {
                scrollInterval = setInterval(() => {
                    const direction = currentY < scrollThreshold ? -1 : 1;
                    window.scrollBy(0, direction * scrollSpeed);
                    // Re-check hit because items moved under the mouse
                    updateTargetUnderMouse(currentX, currentY);
                }, 20);
            }

            updateTargetUnderMouse(currentX, currentY);
        };

        const onUp = (ev) => {
            if (scrollInterval) clearInterval(scrollInterval);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            const wId = dragWorkerRef.current;
            dragWorkerRef.current = null;

            const els = document.elementsFromPoint(ev.clientX, ev.clientY);
            const hit = els.find(el => el.dataset && el.dataset.scheduleId);

            setDragState(null);

            if (hit && wId) {
                const targetSchedule = schedules.find(s => String(s.id) === String(hit.dataset.scheduleId));
                setMoveConfirm({
                    workerId: wId,
                    workerName: workerName,
                    targetScheduleId: hit.dataset.scheduleId,
                    targetScheduleName: targetSchedule ? targetSchedule.name : 'Nuevo Turno',
                    date: new Date().toISOString().split('T')[0]
                });
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // --- Custom Mouse Drag for Schedule Reordering ---
    const startScheduleDrag = (e, scheduleId, scheduleName) => {
        e.preventDefault();
        e.stopPropagation();
        dragScheduleRef.current = scheduleId;
        setScheduleDragState({ scheduleId, scheduleName, x: e.clientX, y: e.clientY, targetScheduleId: null });

        const onMove = (ev) => {
            const els = document.elementsFromPoint(ev.clientX, ev.clientY);
            const hit = els.find(el => el.dataset && el.dataset.scheduleRowId);
            setScheduleDragState(prev => prev
                ? { ...prev, x: ev.clientX, y: ev.clientY, targetScheduleId: hit ? hit.dataset.scheduleRowId : null }
                : null
            );
        };

        const onUp = (ev) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const sId = dragScheduleRef.current;
            dragScheduleRef.current = null;
            setScheduleDragState(null);

            const els = document.elementsFromPoint(ev.clientX, ev.clientY);
            const hit = els.find(el => el.dataset && el.dataset.scheduleRowId);
            if (!hit || !sId || hit.dataset.scheduleRowId === String(sId)) return;

            // Build new order: move sId before targetScheduleId
            const currentIds = schedules.map(s => s.id);
            const filtered = currentIds.filter(id => id !== Number(sId));
            const targetIdx = filtered.indexOf(Number(hit.dataset.scheduleRowId));
            filtered.splice(targetIdx, 0, Number(sId));

            router.post(route('shifts.schedules.reorder'), {
                ordered_ids: filtered
            }, { preserveScroll: true, preserveState: true });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // --- Selection Logic ---
    const handleMouseDown = (e, scheduleId, workerId, day, m, y, isBeforeStartDate) => {
        if (isBeforeStartDate) return;
        if (e.button !== 0) return;

        setIsDragging(true);
        setSelectionStart({ scheduleId, workerId, day, m, y });
        setSelectionCurrent({ scheduleId, workerId, day, m, y });
        setSelectedCells([{ scheduleId, workerId, day, m, y }]);
        setActiveCell(null);
    };

    const handleMouseEnter = (e, scheduleId, workerId, day, m, y, isBeforeStartDate, note) => {
        if (note && !isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoveredNote({
                note,
                x: rect.left + rect.width / 2,
                y: rect.top + window.scrollY - 8
            });
        }

        if (!isDragging || isBeforeStartDate) return;
        setSelectionCurrent({ scheduleId, workerId, day, m, y });

        if (selectionStart && selectionStart.workerId === workerId && selectionStart.scheduleId === scheduleId) {
            const startIndex = allDaysArray.findIndex(d => d.day === selectionStart.day && d.month === selectionStart.m && d.year === selectionStart.y);
            const currentIndex = allDaysArray.findIndex(d => d.day === day && d.month === m && d.year === y);

            if (startIndex === -1 || currentIndex === -1) return;

            const minIdx = Math.min(startIndex, currentIndex);
            const maxIdx = Math.max(startIndex, currentIndex);

            const newSelection = [];
            for (let i = minIdx; i <= maxIdx; i++) {
                const d = allDaysArray[i];
                newSelection.push({ scheduleId, workerId, day: d.day, m: d.month, y: d.year });
            }

            setSelectedCells(newSelection);
        }
    };

    const handleMouseUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        if (selectedCells.length > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            let dayText = '';
            if (selectedCells.length === 1) {
                dayText = `${selectedCells[0].day}/${selectedCells[0].m}`;
            } else {
                dayText = `${selectedCells[0].day}/${selectedCells[0].m} al ${selectedCells[selectedCells.length - 1].day}/${selectedCells[selectedCells.length - 1].m}`;
            }
            setActiveCell({
                cells: selectedCells.map(c => ({ scheduleId: c.scheduleId, workerId: c.workerId, day: c.day, m: c.m, y: c.y })),
                x: rect.left,
                y: rect.bottom + window.scrollY,
                day: dayText
            });
        }
    };

    React.useEffect(() => {
        const handleGlobalMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Track which day is visible during horizontal scroll
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const fixedOffset = 200; // approx width of the two frozen columns
            const containerRect = container.getBoundingClientRect();
            const targetX = containerRect.left + fixedOffset;

            // Query all day-column headers inside this container
            const dayHeaders = container.querySelectorAll('th[data-day-col]');
            let found = null;
            for (const th of dayHeaders) {
                const rect = th.getBoundingClientRect();
                if (rect.left >= targetX - 2) {
                    found = th;
                    break;
                }
            }
            if (found) {
                setVisibleDate({
                    day: found.dataset.day,
                    month: found.dataset.month,
                    year: found.dataset.year,
                    dayName: found.dataset.dayname,
                    monthLabel: found.dataset.monthlabel,
                });
            } else {
                setVisibleDate(null);
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    return (

        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#111827]">Programación de Turnos</h2>
                        <p className="text-[13px] text-[#6B7280]">Planifica días de trabajo, descansos y licencias.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href={route('shifts.groups.index')}
                            className="bg-white border border-[#EAECF0] text-[#374151] px-4 py-2 rounded-xl text-[13px] font-semibold hover:bg-gray-50 transition shadow-sm"
                        >
                            Ver / Crear Grupos
                        </Link>
                        <button
                            onClick={saveChanges}
                            disabled={(Object.keys(localChanges).length === 0 && Object.keys(localNotes).length === 0) || saving}
                            className={`px-5 py-2 rounded-xl text-[13px] font-bold shadow-md transition disabled:shadow-none
                                ${(Object.keys(localChanges).length === 0 && Object.keys(localNotes).length === 0)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                    : 'bg-[#5340FF] text-white shadow-indigo-200 hover:bg-[#4330E0]'}`}
                        >
                            {saving ? 'Guardando...' : `Sincronizado`}
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Turnos" />

            <div className="bg-white rounded-2xl shadow-sm border border-[#EAECF0] p-4 sticky left-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 bg-[#F9FAFB] p-2 rounded-xl border border-[#EAECF0] self-start">
                        <button
                            onClick={() => navigateMonth(-1)}
                            disabled={isPrevMonthDisabled}
                            className={`p-2 rounded-lg transition ${isPrevMonthDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-[#6B7280] hover:bg-white'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="min-w-[140px] text-center font-bold text-[#374151] text-[14px] uppercase tracking-wider">
                            {new Date(year, month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            onClick={() => navigateMonth(1)}
                            disabled={isNextMonthDisabled}
                            className={`p-2 rounded-lg transition ${isNextMonthDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-[#6B7280] hover:bg-white'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                        {SHIFT_TYPES.filter(t => t.id !== 'clear').map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded shadow-sm ${t.color.split(' ')[0]}`}></div>
                                <span className="text-[#6B7280]">{t.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#EAECF0] relative">
                {/* Floating date indicator shown during horizontal scroll */}
                {visibleDate && (
                    <div className="sticky top-0 left-0 z-[60] pointer-events-none">
                        <div className="absolute top-1 left-[210px] flex items-center gap-1.5 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg shadow-indigo-200 animate-in fade-in duration-150">
                            <span className="opacity-70">{visibleDate.monthLabel}</span>
                            <span>{visibleDate.dayName}</span>
                            <span className="text-indigo-200">{visibleDate.day}</span>
                        </div>
                    </div>
                )}
                <div ref={scrollContainerRef} className="overflow-x-auto rounded-2xl">
                    <table className="w-full text-left border-collapse min-w-max text-[12px]">
                        <thead className="sticky top-0 z-40 shadow-sm">
                            <tr>
                                <th rowSpan={2} className="sticky left-0 top-0 z-50 bg-[#F9FAFB] border-b border-[#EAECF0] px-3 font-bold text-[#6B7280] text-[11px] align-middle">
                                    Turno
                                </th>
                                <th rowSpan={2} className="sticky left-[60px] top-0 z-50 bg-[#F9FAFB] border-b border-r border-[#EAECF0] px-4 font-bold text-[#374151] text-[11px] whitespace-nowrap align-middle">
                                    Nombre Trabajador
                                </th>
                                {monthsData.map((m) => (
                                    <th key={`${m.year}_${m.month}`} colSpan={m.daysInMonth} className="bg-white border-b border-r border-[#EAECF0] text-center h-[28px] align-middle sticky top-0 z-30">
                                        <span className="text-indigo-600 font-extrabold text-[10px] uppercase tracking-tighter">
                                            {new Date(m.year, m.month - 1).toLocaleString('es', { month: 'long' })}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                            <tr className="sticky top-[28px] z-30">
                                {monthsData.map((m) => {
                                    const monthLabel = new Date(m.year, m.month - 1).toLocaleString('es', { month: 'short' });
                                    const monthDays = Array.from({ length: m.daysInMonth }, (_, i) => i + 1);
                                    return (
                                        <React.Fragment key={`${m.year}_${m.month}`}>
                                            {monthDays.map(day => {
                                                const dName = getDayName(day, m.month, m.year);
                                                const isWeekend = dName === 'Sa' || dName === 'Do';
                                                return (
                                                    <th
                                                        key={`${m.year}_${m.month}_${day}`}
                                                        data-day-col
                                                        data-day={day}
                                                        data-month={m.month}
                                                        data-year={m.year}
                                                        data-dayname={dName}
                                                        data-monthlabel={monthLabel}
                                                        className="bg-[#F9FAFB] border-b border-r border-[#EAECF0] p-0 min-w-[34px] sticky top-[28px] z-30"
                                                    >
                                                        <div className={`flex flex-col items-center justify-center py-1.5 h-[34px] leading-tight ${isWeekend ? 'bg-amber-50/50 text-amber-700' : 'text-[#6B7280]'}`}>
                                                            <span className="text-[10px] opacity-80 leading-none mb-0.5">{dName}</span>
                                                            <span className="text-[12px] leading-none">{day}</span>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.map((schedule, sIndex) => {
                                const allScheduleWorkers = schedule.workers || [];

                                // Filter workers that should actually appear in this range
                                const visibleWorkers = allScheduleWorkers.filter(worker => {
                                    if (!worker.pivot.end_date) return true; // Active assignments
                                    return allDaysArray.some(d => {
                                        const dt = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                                        return (!worker.pivot.start_date || dt >= worker.pivot.start_date) && (dt <= worker.pivot.end_date);
                                    });
                                });

                                // Group by worker ID to combine current + historical records into one row
                                const workersById = new Map();
                                visibleWorkers.forEach(w => {
                                    if (!workersById.has(w.id)) {
                                        workersById.set(w.id, { ...w, allPivots: [w.pivot] });
                                    } else {
                                        workersById.get(w.id).allPivots.push(w.pivot);
                                    }
                                });
                                const groupedWorkers = Array.from(workersById.values());

                                if (groupedWorkers.length === 0) {
                                    const isTarget = dragState?.targetScheduleId === String(schedule.id);
                                    return (
                                        <React.Fragment key={schedule.id}>
                                            {sIndex > 0 && (
                                                <tr>
                                                    <td colSpan={allDaysArray.length + 2} className="p-0 h-[3px]" style={{ backgroundColor: '#F97316' }} />
                                                </tr>
                                            )}
                                            <tr
                                                className={`group transition-all ${isTarget ? 'outline outline-2 outline-indigo-400 bg-indigo-50' : 'hover:bg-gray-50/50'}`}
                                            >
                                                <td data-schedule-id={schedule.id}
                                                    className="sticky left-0 z-10 bg-white border-b border-[#EAECF0] font-bold text-center border-r-[3px]"
                                                    style={{ borderRightColor: schedule.color || '#E5E7EB' }}>
                                                    <div className="flex items-center justify-center h-full px-1">
                                                        <div className="text-[#111827] tracking-tighter text-[10px] font-bold uppercase break-words max-w-[50px] leading-none">
                                                            {schedule.name}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td data-schedule-id={schedule.id}
                                                    className="sticky left-[60px] z-10 bg-white border-b border-r border-[#EAECF0] px-4 h-[34px] align-middle whitespace-nowrap">
                                                    {isTarget
                                                        ? <span className="text-[11px] text-indigo-500 font-bold">⬇ Soltar aquí</span>
                                                        : <span className="text-[11px] text-gray-400 italic">Sin trabajadores</span>
                                                    }
                                                </td>
                                                {allDaysArray.map((_, i) => (
                                                    <td key={i} data-schedule-id={schedule.id}
                                                        className={`border-b border-r border-[#EAECF0] ${isTarget ? 'bg-indigo-50/40' : 'bg-gray-50/5'}`}></td>
                                                ))}
                                            </tr>
                                        </React.Fragment>
                                    );
                                }

                                return (
                                    <React.Fragment key={schedule.id}>
                                                {/* Zapote separator between shift groups */}
                                                {sIndex > 0 && (
                                                    <tr>
                                                        <td colSpan={allDaysArray.length + 2} className="p-0 h-[3px]" style={{ backgroundColor: '#F97316' }} />
                                                    </tr>
                                                )}
                                                {groupedWorkers.map((worker, wIndex) => {
                                                    const isTargetSchedule = dragState?.targetScheduleId === String(schedule.id);
                                                    return (
                                                        <tr key={`${schedule.id}_${worker.id}`}
                                                            data-schedule-row-id={schedule.id}
                                                            className={`group transition-all ${isTargetSchedule ? 'bg-indigo-50/80' : 'hover:bg-gray-50/50'}
                                                        ${scheduleDragState?.targetScheduleId === String(schedule.id) ? 'outline outline-2 outline-amber-300' : ''}`}
                                                        >
                                                            {wIndex === 0 && (
                                                                <td rowSpan={groupedWorkers.length}
                                                                    data-schedule-id={schedule.id}
                                                                    data-schedule-row-id={schedule.id}
                                                                    className={`sticky left-0 z-10 bg-white border-b border-[#EAECF0] font-bold text-center border-r-[3px] transition-colors
                                                                ${isTargetSchedule ? 'bg-indigo-50' : ''}
                                                                ${scheduleDragState?.targetScheduleId === String(schedule.id) ? 'bg-amber-50 border-t-2 border-t-amber-400' : ''}`}
                                                                    style={{ borderRightColor: schedule.color || '#E5E7EB' }}>
                                                                    <div className="flex flex-col items-center justify-center h-full px-1 gap-1 relative">
                                                                        <div
                                                                            className="absolute top-0.5 left-1/2 -translate-x-1/2 text-gray-300 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-100"
                                                                            onMouseDown={(e) => startScheduleDrag(e, schedule.id, schedule.name)}
                                                                            title="Arrastra para reordenar turno"
                                                                        >
                                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                                                        </div>
                                                                        <div className="text-[#111827] tracking-tighter text-[10px] font-bold uppercase break-words max-w-[50px] leading-none mt-3">
                                                                            {schedule.name}
                                                                        </div>
                                                                        <div className="text-[8px] text-emerald-600 font-bold mt-1 opacity-80" title="Fecha de origen del turno">
                                                                            {schedule.start_date ? new Date(schedule.start_date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : 'S/F'}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            )}

                                                            <td data-schedule-id={schedule.id}
                                                                className={`sticky left-[60px] z-10 bg-white border-b border-r border-[#EAECF0] px-4 h-[34px] align-middle whitespace-nowrap select-none
                                                            ${dragState ? 'cursor-copy' : 'cursor-default'}
                                                            ${isTargetSchedule ? 'bg-indigo-50' : ''}`}
                                                                title="Arrastra para mover a otro turno"
                                                            >
                                                                <div className="flex items-center gap-2 h-full">
                                                                    <div
                                                                        className="text-gray-400 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-100"
                                                                        onMouseDown={(e) => startWorkerDrag(e, worker.id, `${worker.nombres.toLowerCase()} ${worker.apellido_paterno.toLowerCase()}`)}
                                                                        title="Arrastra para mover de turno"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" /></svg>
                                                                    </div>
                                                                    <span className="font-semibold text-[#374151] text-[11px] leading-none capitalize">
                                                                        {worker.nombres.toLowerCase()} {worker.apellido_paterno.toLowerCase()}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {allDaysArray.map((dateObj, dIdx) => {
                                                                const { day, month: dMonth, year: dYear } = dateObj;
                                                                const dateStr = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                                                                const activePivot = worker.allPivots.find(p => (!p.start_date || dateStr >= p.start_date) && (!p.end_date || dateStr <= p.end_date));

                                                                // Workers appearing inside schedule.workers are already assigned to this schedule
                                                                // (filtered server-side). The pivot does not carry shift_schedule_id.
                                                                const isAssignedToThisSchedule = true;
                                                                const isBeforeScheduleStart = schedule.start_date && dateStr < schedule.start_date;
                                                                const isOutsideAssignment = !isAssignedToThisSchedule || isBeforeScheduleStart;

                                                                const isBeforeStartDate = isBeforeScheduleStart; // Alias for clarity
                                                                const isScheduleStartDate = schedule.start_date && dateStr === schedule.start_date;
                                                                const cellType = getCellType(schedule.id, worker.id, day, dMonth, dYear);
                                                                const typeConfig = SHIFT_TYPES.find(t => t.id === cellType);
                                                                const cellNote = getCellNote(schedule.id, worker.id, day, dMonth, dYear);
                                                                const isSelected = selectedCells.some(c => c.scheduleId === schedule.id && c.workerId === worker.id && c.day === day && c.m === dMonth && c.y === dYear);
                                                                const hasActiveInSchedule = worker.allPivots.some(p => !p.end_date);
                                                                const isHistorical = activePivot && !!activePivot.end_date && !hasActiveInSchedule;

                                                                return (
                                                                    <td key={`${dYear}_${dMonth}_${day}`}
                                                                        data-schedule-id={schedule.id}
                                                                        onMouseDown={(e) => { if (!isOutsideAssignment && !dragState) handleMouseDown(e, schedule.id, worker.id, day, dMonth, dYear, isBeforeStartDate); }}
                                                                        onMouseEnter={(e) => { if (!isOutsideAssignment && !dragState) handleMouseEnter(e, schedule.id, worker.id, day, dMonth, dYear, isBeforeStartDate, cellNote); }}
                                                                        onMouseUp={handleMouseUp}
                                                                        onMouseLeave={() => setHoveredNote(null)}
                                                                        title={isScheduleStartDate ? `Inicio del turno: ${schedule.start_date}` : undefined}
                                                                        className={`border-b border-r border-[#EAECF0] text-center p-0 relative transition-colors w-[34px] h-[34px]
                                                                    ${dragState ? 'cursor-copy' : (!isBeforeStartDate && !isOutsideAssignment ? 'cursor-pointer' : 'bg-gray-50/30 opacity-40 cursor-not-allowed')}
                                                                    ${!isBeforeStartDate && !isOutsideAssignment ? (typeConfig ? typeConfig.color : 'bg-white hover:bg-gray-50') : ''}
                                                                    ${typeConfig && isHistorical ? 'relative after:absolute after:inset-0 after:bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.3)_4px,rgba(255,255,255,0.3)_8px)]' : ''}
                                                                    ${cellNote && !isBeforeStartDate && !isOutsideAssignment ? 'ring-2 ring-inset ring-amber-400 z-10' : ''}
                                                                    ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-20' : ''}
                                                                    ${isScheduleStartDate ? 'border-l-[4px] border-l-emerald-500 shadow-[inset_4px_0_0_0_rgba(16,185,129,0.1)]' : ''}`}
                                                                    >
                                                                        {/* Start date flag — only on first worker row */}
                                                                        {isScheduleStartDate && wIndex === 0 && (
                                                                            <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-l-[12px] border-t-emerald-500 border-l-transparent z-30 pointer-events-none"
                                                                                style={{ borderLeftColor: 'transparent', borderTopColor: '#10b981', transform: 'scaleX(-1)' }}
                                                                            />
                                                                        )}
                                                                        {cellNote && !isOutsideAssignment && (
                                                                            <div className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full shadow-sm z-20"></div>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                    </React.Fragment>
                                );
                            })}
                                            {schedules.length === 0 && (
                                                <tr>
                                                    <td colSpan={allDaysArray.length + 2} className="text-center p-12 text-[#9CA3AF] bg-[#F9FAFB]">
                                                        Aún no hay programaciones para este período.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating ghost following the cursor during drag */}
            {dragState && (
                <div
                    className="fixed z-[9999] pointer-events-none select-none"
                    style={{ left: dragState.x + 14, top: dragState.y - 14 }}
                >
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold shadow-2xl border-2 transition-colors
                        ${dragState.targetScheduleId ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white text-gray-700 border-gray-200'}`}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" /></svg>
                        <span className="capitalize">{dragState.workerName}</span>
                    </div>
                </div>
            )}

            {/* Floating ghost for schedule reorder drag */}
            {scheduleDragState && (
                <div
                    className="fixed z-[9999] pointer-events-none select-none"
                    style={{ left: scheduleDragState.x + 14, top: scheduleDragState.y - 14 }}
                >
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold shadow-2xl border-2 transition-colors
                        ${scheduleDragState.targetScheduleId ? 'bg-amber-500 text-white border-amber-300' : 'bg-white text-gray-700 border-gray-200'}`}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span className="uppercase text-[10px] tracking-wide">{scheduleDragState.scheduleName}</span>
                    </div>
                </div>
            )}

            {activeCell && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setActiveCell(null)}></div>
                    <div className="absolute z-50 bg-white rounded-xl shadow-xl border border-[#EAECF0] w-48 p-2 overflow-hidden"
                        style={{
                            left: Math.min(activeCell.x, window.innerWidth - 200),
                            top: activeCell.y + 4
                        }}>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase border-b mx-2 mb-2 block">
                                Día {activeCell.day}
                            </span>
                            {activeCell.cells.length === 1 && (
                                <div className="px-2 pb-2 border-b mb-1">
                                    <textarea
                                        className="w-full text-[11px] p-2 border border-[#EAECF0] rounded-lg shrink-0"
                                        rows="2"
                                        placeholder="Comentario..."
                                        value={getCellNote(activeCell.cells[0].scheduleId, activeCell.cells[0].workerId, activeCell.cells[0].day, activeCell.cells[0].m, activeCell.cells[0].y) || ''}
                                        onChange={(e) => {
                                            const { scheduleId, workerId, day, m, y } = activeCell.cells[0];
                                            const key = `${scheduleId}_${workerId}_${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            setLocalNotes(prev => ({ ...prev, [key]: e.target.value }));
                                        }}
                                        onBlur={() => saveChanges()}
                                    />
                                </div>
                            )}
                            {SHIFT_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectType(type.id)}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 text-[11px] font-semibold transition"
                                >
                                    <div className={`w-3.5 h-3.5 rounded ${type.color.split(' ')[0]}`}></div>
                                    <span>{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {hoveredNote && !isDragging && (
                <div
                    className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
                    style={{ left: hoveredNote.x, top: hoveredNote.y - window.scrollY }}
                >
                    <div className="bg-white text-gray-800 text-[11px] font-semibold px-3 py-2 rounded-lg shadow-xl border border-[#EAECF0]">
                        {hoveredNote.note}
                    </div>
                </div>
            )}
            {moveConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMoveConfirm(null)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-[20px] font-black text-[#111827] mb-2">Cambio de Turno</h3>
                            <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-6">
                                ¿Desde qué fecha estará vigente el <span className="text-indigo-600 font-bold">{moveConfirm.targetScheduleName}</span> para <span className="text-gray-900 font-bold">{moveConfirm.workerName}</span>?
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Fecha de Vigencia</label>
                                    <input
                                        type="date"
                                        value={moveConfirm.date}
                                        onChange={(e) => setMoveConfirm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full bg-[#F9FAFB] border-[#EAECF0] rounded-xl text-[14px] font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 flex gap-3">
                            <button
                                onClick={() => setMoveConfirm(null)}
                                className="flex-1 px-4 py-3 rounded-xl text-[13px] font-black text-gray-500 hover:bg-gray-100 transition-colors uppercase tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    router.post(route('shifts.groups.assign', moveConfirm.targetScheduleId), {
                                        worker_ids: [moveConfirm.workerId],
                                        start_date: moveConfirm.date
                                    }, {
                                        preserveScroll: true,
                                        onSuccess: () => setMoveConfirm(null)
                                    });
                                }}
                                className="flex-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-indigo-100 uppercase tracking-wider active:scale-95"
                            >
                                Confirmar Cambio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
