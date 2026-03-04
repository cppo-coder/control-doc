import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Index({ workers }) {
    const { data, setData, post, patch, processing, errors, reset, delete: destroy } = useForm({
        id: null,
        rut: '',
        nacionalidad: 'Chilena',
        pasaporte: '',
        documento_identidad: '',
        nombres: '',
        apellido_paterno: '',
        apellido_materno: '',
        fecha_nacimiento: '',
        estado_civil: '',
        direccion: '',
        comuna: '',
        email: '',
        phone: '',
        whatsapp: '',
        emergencia_contacto_numero: '',
        emergencia_contacto_nombre: '',
        cta_bancaria: '',
        cod_banco: '',
        tipo_cuenta: '',
        beneficiario_direccion: '',
        beneficiario_ciudad: '',
        beneficiario_cta_abono: '',
        beneficiario_swift: '',
        position: '',
        department: '',
    });

    const [isEditing, setIsEditing] = useState(false);
    const [idType, setIdType] = useState('rut');
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const CHILEAN_BANKS = [
        { code: '001', name: 'Banco de Chile' },
        { code: '009', name: 'Banco Internacional' },
        { code: '012', name: 'Banco del Estado de Chile' },
        { code: '014:Scotiabank', name: 'Scotiabank Chile' },
        { code: '016', name: 'Banco de Crédito e Inversiones (BCI)' },
        { code: '027', name: 'Banco Itaú Chile' },
        { code: '028', name: 'Banco BICE' },
        { code: '031', name: 'HSBC Bank (Chile)' },
        { code: '037', name: 'Banco Santander-Chile' },
        { code: '039', name: 'Itaú Corpbanca' },
        { code: '049', name: 'Banco Security' },
        { code: '051', name: 'Banco Falabella' },
        { code: '053', name: 'Banco Ripley' },
        { code: '055', name: 'Banco Consorcio' },
        { code: '059', name: 'Banco BTG Pactual Chile' },
        { code: '071', name: 'Tenpo Prepago' },
        { code: '072', name: 'Mercado Pago' }
    ];

    const ACCOUNT_TYPES = [
        'Cuenta Corriente',
        'Cuenta Vista / Cuenta RUT',
        'Cuenta de Ahorro',
        'Chequera Electrónica'
    ];

    const MARITAL_STATUS_OPTIONS = [
        'Soltero(a)',
        'Casado(a)',
        'Viudo(a)',
        'Divorciado(a)',
        'Conviviente Civil'
    ];

    const formatAndValidateRut = (value) => {
        // Remove everything except numbers and K/k
        let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
        if (!clean) return { formatted: '', isValid: true };

        // Limit length
        clean = clean.slice(0, 9);

        // Format: 12.345.678-9
        let formatted = clean;
        if (clean.length > 1) {
            const body = clean.slice(0, -1);
            const dv = clean.slice(-1);
            formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
        }

        // Validate
        let isValid = true;
        if (clean.length >= 8) {
            const body = clean.slice(0, -1);
            const dv = clean.slice(-1);

            let sum = 0;
            let multiplier = 2;
            for (let i = body.length - 1; i >= 0; i--) {
                sum += parseInt(body[i]) * multiplier;
                multiplier = multiplier === 7 ? 2 : multiplier + 1;
            }
            const expectedDv = 11 - (sum % 11);
            const dvStr = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
            isValid = dv === dvStr;
        }

        return { formatted, isValid, clean };
    };

    const handleIdChange = (e, field) => {
        const val = e.target.value;
        if (field === 'rut' || (field === 'documento_identidad' && data.nacionalidad !== 'Chilena')) {
            const { formatted, isValid } = formatAndValidateRut(val);
            setData(field, formatted);
            // Optional: You could set a local error state here if you want immediate red text
        } else {
            setData(field, val);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            patch(route('workers.update', data.id), {
                onSuccess: () => {
                    setIsEditing(false);
                    reset();
                    setIdType('rut');
                    showToast('Ficha actualizada correctamente.');
                },
            });
        } else {
            post(route('workers.store'), {
                onSuccess: () => {
                    reset();
                    setIdType('rut');
                    showToast('Trabajador guardado exitosamente.');
                },
            });
        }
    };

    const handleEdit = (worker) => {
        setIsEditing(true);
        setData({
            id: worker.id,
            rut: worker.rut || '',
            nacionalidad: worker.nacionalidad || '',
            pasaporte: worker.pasaporte || '',
            documento_identidad: worker.documento_identidad || '',
            nombres: worker.nombres || '',
            apellido_paterno: worker.apellido_paterno || '',
            apellido_materno: worker.apellido_materno || '',
            fecha_nacimiento: worker.fecha_nacimiento || '',
            estado_civil: worker.estado_civil || '',
            direccion: worker.direccion || '',
            comuna: worker.comuna || '',
            email: worker.email || '',
            phone: worker.phone || '',
            whatsapp: worker.whatsapp || '',
            emergencia_contacto_numero: worker.emergencia_contacto_numero || '',
            emergencia_contacto_nombre: worker.emergencia_contacto_nombre || '',
            cta_bancaria: worker.cta_bancaria || '',
            cod_banco: worker.cod_banco || '',
            tipo_cuenta: worker.tipo_cuenta || '',
            beneficiario_direccion: worker.beneficiario_direccion || '',
            beneficiario_ciudad: worker.beneficiario_ciudad || '',
            beneficiario_cta_abono: worker.beneficiario_cta_abono || '',
            beneficiario_swift: worker.beneficiario_swift || '',
            position: worker.position || '',
            department: worker.department || '',
        });

        if (worker.nacionalidad && worker.nacionalidad !== 'Chilena') {
            setIdType('pasaporte');
        } else {
            setIdType('rut');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        reset();
        setIdType('rut');
    };

    const handleDelete = (id) => {
        if (confirm('¿Estás seguro de eliminar este registro?')) {
            destroy(route('workers.destroy', id));
        }
    };


    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-[26px] font-black tracking-tight text-[#111827]">Ficha de Registro de Personal</h2>
                    <p className="text-[14px] font-medium text-[#6B7280]">Gestión centralizada de expedientes de trabajadores</p>
                </div>
            }
        >
            <Head title="Registro de Personal" />

            {/* TOAST NOTIFICATION */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-white border border-green-200 shadow-xl shadow-green-100/50 rounded-2xl px-5 py-4 animate-fade-in-down">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-[#111827]">{toast.message}</p>
                        <p className="text-[11px] text-[#6B7280] font-medium">Sistema de Control Documental</p>
                    </div>
                    <button onClick={() => setToast(null)} className="ml-2 text-[#9CA3AF] hover:text-[#111827] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="w-full max-w-5xl mx-auto pb-12 px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-3xl border border-[#EAECF0] shadow-[0_8px_30px_rgba(83,64,255,0.06)] overflow-hidden">
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#F3F4F6]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#5340FF] to-[#8275FF] rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200/50 cursor-default">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-black text-[#111827] tracking-tight">
                                        {isEditing ? 'Gestión de Expediente' : 'Alta de Nuevo Integrante'}
                                    </h3>
                                    <div className="flex items-center gap-2.5 mt-1.5">
                                        <div className="flex gap-0.5">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                        </div>
                                        <p className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.2em] leading-none">Módulo RR.HH • Formulario Activo</p>
                                    </div>
                                </div>
                            </div>

                            {isEditing && (
                                <div className="flex items-center gap-3 bg-[#F9FAFB] px-4 py-2 rounded-2xl border border-[#EAECF0]">
                                    <div className="w-8 h-8 rounded-full bg-[#5340FF]/10 flex items-center justify-center text-[#5340FF] font-black text-[10px]">ED</div>
                                    <p className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wide">Editando ID: <span className="text-[#111827]">{data.id}</span></p>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* SECCION 1: IDENTIFICACION */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#5340FF] text-white text-sm font-black shadow-lg shadow-indigo-100 ring-4 ring-indigo-50/50 transition-transform hover:scale-105 cursor-default">1</div>
                                    <h4 className="text-[13px] font-black text-[#111827] uppercase tracking-[0.2em]">Dato de identidad</h4>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[#F3F4F6] to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="xl:col-span-2">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Documento Principal <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center group">
                                            <div className="absolute left-0 w-[64px] h-full flex items-center justify-center border-r border-[#EAECF0]">
                                                <span className="text-[11px] font-black text-[#5340FF] uppercase tracking-wider">
                                                    {idType === 'rut' ? 'RUT' : 'PAS'}
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={idType === 'rut' ? data.rut : data.pasaporte}
                                                onChange={e => handleIdChange(e, idType === 'rut' ? 'rut' : 'pasaporte')}
                                                className={`w-full h-11 pl-[80px] pr-4 rounded-xl border ${idType === 'rut' && data.rut && !formatAndValidateRut(data.rut).isValid ? 'border-red-300 bg-red-50/30' : 'border-[#EAECF0] bg-[#F9FAFB]'} text-[13px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm`}
                                                placeholder={idType === 'rut' ? '12.345.678-9' : 'Número de Pasaporte'}
                                            />
                                        </div>
                                        {idType === 'rut' && data.rut && !formatAndValidateRut(data.rut).isValid && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 bg-red-500 rounded-full"></span>RUT no válido</p>}
                                        {idType === 'rut' && errors.rut && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 bg-red-500 rounded-full"></span>{errors.rut}</p>}
                                        {idType === 'pasaporte' && errors.pasaporte && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 bg-red-500 rounded-full"></span>{errors.pasaporte}</p>}
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1 whitespace-nowrap">Nacionalidad <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <select
                                                value={data.nacionalidad}
                                                required
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setData('nacionalidad', val);
                                                    if (val && val !== 'Chilena') {
                                                        setIdType('pasaporte');
                                                    } else if (val === 'Chilena') {
                                                        setIdType('rut');
                                                    }
                                                }}
                                                className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm appearance-none cursor-pointer pr-12"
                                                style={{ backgroundImage: 'none' }}
                                            >
                                                <option value="Chilena">Chilena 🇨🇱</option>
                                                <option value="Mexicana">Mexicana 🇲🇽</option>
                                                <option value="Peruana">Peruana 🇵🇪</option>
                                                <option value="Canadiense">Canadiense 🇨🇦</option>
                                            </select>
                                            <div className="absolute right-6 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {errors.nacionalidad && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.nacionalidad}</p>}
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1 whitespace-nowrap">
                                            {(data.nacionalidad && data.nacionalidad !== 'Chilena') ? 'RUT / ID Chile' : 'Número de Pasaporte'}
                                        </label>
                                        <input
                                            type="text"
                                            value={data.documento_identidad}
                                            onChange={e => handleIdChange(e, 'documento_identidad')}
                                            className={`w-full h-11 px-5 rounded-xl border ${data.documento_identidad && data.nacionalidad !== 'Chilena' && !formatAndValidateRut(data.documento_identidad).isValid ? 'border-red-300 bg-red-50/30' : 'border-[#EAECF0] bg-[#F9FAFB]'} text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm`}
                                            placeholder={(data.nacionalidad && data.nacionalidad !== 'Chilena') ? '12.345.678-9' : 'Nº Pasaporte'}
                                        />
                                        {data.documento_identidad && data.nacionalidad !== 'Chilena' && !formatAndValidateRut(data.documento_identidad).isValid && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 bg-red-500 rounded-full"></span>RUT no válido</p>}
                                        {errors.documento_identidad && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.documento_identidad}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* SECCION 2: NOMBRES Y APELIDOS */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#64748B] text-white text-sm font-black shadow-lg shadow-slate-100 ring-4 ring-slate-50/50 transition-transform hover:scale-105 cursor-default">2</div>
                                    <h4 className="text-[13px] font-black text-[#111827] uppercase tracking-[0.2em]">Datos Personales</h4>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[#F3F4F6] to-transparent"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-8">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Nombres Completos <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.nombres} onChange={e => setData('nombres', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" placeholder="Ej: Juan Antonio" />
                                        {errors.nombres && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.nombres}</p>}
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Apellido Paterno <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.apellido_paterno} onChange={e => setData('apellido_paterno', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.apellido_paterno && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.apellido_paterno}</p>}
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Apellido Materno <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.apellido_materno} onChange={e => setData('apellido_materno', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.apellido_materno && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.apellido_materno}</p>}
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Fecha de Nacimiento <span className="text-red-500">*</span></label>
                                        <input type="date" required value={data.fecha_nacimiento} onChange={e => setData('fecha_nacimiento', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.fecha_nacimiento && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.fecha_nacimiento}</p>}
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Estado Civil <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <select
                                                required
                                                value={data.estado_civil}
                                                onChange={e => setData('estado_civil', e.target.value)}
                                                className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm appearance-none cursor-pointer pr-12"
                                                style={{ backgroundImage: 'none' }}
                                            >
                                                {MARITAL_STATUS_OPTIONS.map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-6 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {errors.estado_civil && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.estado_civil}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* SECCION 3: UBICACION Y CONTACTO */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#0891B2] text-white text-sm font-black shadow-lg shadow-cyan-100 ring-4 ring-cyan-50/50 transition-transform hover:scale-105 cursor-default">3</div>
                                    <h4 className="text-[13px] font-black text-[#111827] uppercase tracking-[0.2em]">Ubicación y Comunicación</h4>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[#F3F4F6] to-transparent"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                                    <div className="lg:col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Comuna / Ciudad <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.comuna} onChange={e => setData('comuna', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.comuna && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.comuna}</p>}
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Dirección Residencia <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.direccion} onChange={e => setData('direccion', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.direccion && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.direccion}</p>}
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Correo Electrónico <span className="text-red-500">*</span></label>
                                        <input type="email" required value={data.email} onChange={e => setData('email', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" placeholder="correo@corporativo.com" />
                                        {errors.email && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.email}</p>}
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Teléfono Móvil <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.phone} onChange={e => setData('phone', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.phone && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.phone}</p>}
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">WhatsApp / Celular <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.whatsapp} onChange={e => setData('whatsapp', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#5340FF]/10 focus:border-[#5340FF] focus:bg-white transition-all outline-none shadow-sm" />
                                        {errors.whatsapp && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.whatsapp}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* SECCION 4: CONTACTO EMERGENCIA */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#F43F5E] text-white text-sm font-black shadow-lg shadow-rose-100 ring-4 ring-rose-50/50 transition-transform hover:scale-105 cursor-default">4</div>
                                    <h4 className="text-[13px] font-black text-[#111827] uppercase tracking-[0.2em]">Emergencia y Respaldo</h4>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[#F3F4F6] to-transparent"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Nombre del Contacto Directo <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.emergencia_contacto_nombre} onChange={e => setData('emergencia_contacto_nombre', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#F43F5E]/10 focus:border-[#F43F5E] focus:bg-white transition-all outline-none shadow-sm" placeholder="Nombre completo del familiar" />
                                        {errors.emergencia_contacto_nombre && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.emergencia_contacto_nombre}</p>}
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Teléfono de Emergencia <span className="text-red-500">*</span></label>
                                        <input type="text" required value={data.emergencia_contacto_numero} onChange={e => setData('emergencia_contacto_numero', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#F43F5E]/10 focus:border-[#F43F5E] focus:bg-white transition-all outline-none shadow-sm" placeholder="+56 9..." />
                                        {errors.emergencia_contacto_numero && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.emergencia_contacto_numero}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* SECCION 5: DATOS BANCARIOS */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#059669] text-white text-sm font-black shadow-lg shadow-emerald-100 ring-4 ring-emerald-50/50 transition-transform hover:scale-105 cursor-default">5</div>
                                    <h4 className="text-[13px] font-black text-[#111827] uppercase tracking-[0.2em]">Información bancaria</h4>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[#F3F4F6] to-transparent"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                    {data.nacionalidad === 'Chilena' && (
                                        <>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Entidad Bancaria <span className="text-red-500">*</span></label>
                                                <div className="relative flex items-center">
                                                    <select
                                                        required
                                                        value={data.cod_banco}
                                                        onChange={e => setData('cod_banco', e.target.value)}
                                                        className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm appearance-none cursor-pointer pr-12"
                                                        style={{ backgroundImage: 'none' }}
                                                    >
                                                        {CHILEAN_BANKS.map(bank => (
                                                            <option key={bank.code} value={bank.code}>{bank.name}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-6 pointer-events-none">
                                                        <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {errors.cod_banco && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.cod_banco}</p>}
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Tipo de Cuenta <span className="text-red-500">*</span></label>
                                                <div className="relative flex items-center">
                                                    <select
                                                        required
                                                        value={data.tipo_cuenta}
                                                        onChange={e => setData('tipo_cuenta', e.target.value)}
                                                        className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm appearance-none cursor-pointer pr-12"
                                                        style={{ backgroundImage: 'none' }}
                                                    >
                                                        {ACCOUNT_TYPES.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-6 pointer-events-none">
                                                        <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {errors.tipo_cuenta && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.tipo_cuenta}</p>}
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Número de Cuenta <span className="text-red-500">*</span></label>
                                                <input type="text" required value={data.cta_bancaria} onChange={e => setData('cta_bancaria', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm" />
                                                {errors.cta_bancaria && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.cta_bancaria}</p>}
                                            </div>
                                        </>
                                    )}

                                    {data.nacionalidad && data.nacionalidad !== 'Chilena' && (
                                        <>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Dirección Beneficiario <span className="text-red-500">*</span></label>
                                                <input type="text" required value={data.beneficiario_direccion} onChange={e => setData('beneficiario_direccion', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm" />
                                                {errors.beneficiario_direccion && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.beneficiario_direccion}</p>}
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Ciudad del Beneficiario <span className="text-red-500">*</span></label>
                                                <input type="text" required value={data.beneficiario_ciudad} onChange={e => setData('beneficiario_ciudad', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm" />
                                                {errors.beneficiario_ciudad && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.beneficiario_ciudad}</p>}
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">Cta. Abono Beneficiario <span className="text-red-500">*</span></label>
                                                <input type="text" required value={data.beneficiario_cta_abono} onChange={e => setData('beneficiario_cta_abono', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm" />
                                                {errors.beneficiario_cta_abono && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.beneficiario_cta_abono}</p>}
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.15em] mb-1.5 ml-1">BIC / SWIFT <span className="text-red-500">*</span></label>
                                                <input type="text" required value={data.beneficiario_swift} onChange={e => setData('beneficiario_swift', e.target.value)} className="w-full h-11 px-5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] text-[15px] font-bold text-[#111827] focus:ring-4 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all outline-none shadow-sm" />
                                                {errors.beneficiario_swift && <p className="mt-2 text-[11px] text-red-500 font-bold ml-1">{errors.beneficiario_swift}</p>}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center gap-4 pt-6 border-t border-[#F3F4F6]">
                                <div className="w-full max-w-md flex flex-col sm:flex-row gap-3">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="flex-[2] h-11 bg-gradient-to-r from-[#5340FF] to-[#7B6DFF] hover:from-[#7B6DFF] hover:to-[#5340FF] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-md shadow-indigo-100/50 disabled:opacity-50 flex items-center justify-center gap-3 group active:scale-[0.98]"
                                    >
                                        <span>{isEditing ? 'Actualizar Ficha Integral' : 'Guardar'}</span>
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </div>
                                    </button>
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            className="flex-1 h-11 bg-white border border-[#EAECF0] text-[#6B7280] text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center rounded-xl hover:bg-gray-50 hover:text-[#111827] transition-all hover:border-[#D1D5DB] gap-2 active:scale-[0.98]"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>Cancelar</span>
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.3em]">Sistema de Control Documental Electrónico v2.0</p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
