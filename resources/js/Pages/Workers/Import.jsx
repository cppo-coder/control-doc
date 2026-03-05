import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

export default function Import() {
    const { data, setData, post, processing, errors } = useForm({
        workers: []
    });

    const [preview, setPreview] = useState([]);
    const [step, setStep] = useState(1);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Mapeo detallado basado en la Ficha de Registro
            const parsed = rawData.slice(1).filter(row => row.length > 0).map(row => {
                return {
                    // IDENTIFICACIÓN
                    nacionalidad: (row[0] || 'Chilena').toString().trim(),
                    rut: (row[1] || '').toString().trim(),
                    pasaporte: (row[2] || '').toString().trim(),
                    documento_identidad: (row[3] || '').toString().trim(),

                    // DATOS PERSONALES
                    nombres: (row[4] || '').toString().trim(),
                    apellido_paterno: (row[5] || '').toString().trim(),
                    apellido_materno: (row[6] || '').toString().trim(),
                    fecha_nacimiento: (row[7] || '').toString().trim(),
                    estado_civil: (row[8] || 'Soltero(a)').toString().trim(),

                    // UBICACIÓN Y CONTACTO
                    comuna: (row[9] || '').toString().trim(),
                    direccion: (row[10] || '').toString().trim(),
                    email: (row[11] || '').toString().trim(),
                    phone: (row[12] || '').toString().trim(),
                    whatsapp: (row[13] || '').toString().trim(),

                    // EMERGENCIA
                    emergencia_contacto_nombre: (row[14] || '').toString().trim(),
                    emergencia_contacto_numero: (row[15] || '').toString().trim(),

                    // DATOS BANCARIOS (CHILE)
                    cod_banco: (row[16] || '').toString().trim(),
                    tipo_cuenta: (row[17] || '').toString().trim(),
                    cta_bancaria: (row[18] || '').toString().trim(),

                    // BANCARIOS INTERNACIONAL
                    beneficiario_direccion: (row[19] || '').toString().trim(),
                    beneficiario_ciudad: (row[20] || '').toString().trim(),
                    beneficiario_cta_abono: (row[21] || '').toString().trim(),
                    beneficiario_swift: (row[22] || '').toString().trim(),

                    // LABORAL
                    position: (row[23] || '').toString().trim(),
                    department: (row[24] || '').toString().trim(),
                    is_active: true
                };
            });

            setPreview(parsed);
            setData('workers', parsed);
            setStep(2);
        };

        reader.readAsBinaryString(file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('workers.bulk-store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-[26px] font-black tracking-tight text-[#111827]">Importación masiva de Personal</h2>
                    <p className="text-[14px] font-medium text-[#6B7280]">Carga el expediente completo mediante archivo Excel (.xlsx)</p>
                </div>
            }
        >
            <Head title="Importar Personal" />

            <div className="max-w-6xl mx-auto py-8">
                <div className="bg-white rounded-3xl border border-[#EAECF0] shadow-sm overflow-hidden">
                    <div className="p-8">
                        {step === 1 && (
                            <div className="space-y-8">
                                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-5">
                                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-100">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div className="text-[14px] text-blue-700 leading-relaxed">
                                        <p className="font-black uppercase tracking-wider mb-2">Estructura del Expediente:</p>
                                        <p className="font-medium mb-3">Tu Excel debe tener los campos en este orden exacto (omitir encabezados en la lectura):</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 font-bold text-[11px] bg-white/40 p-4 rounded-xl border border-blue-100">
                                            <div>
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">IDENTIDAD</p>
                                                <p>1. Nacionalidad</p><p>2. RUT</p><p>3. Pasaporte</p><p>4. Doc. Identidad Chile</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">PERSONALES</p>
                                                <p>5. Nombres</p><p>6. Ap. Paterno</p><p>7. Ap. Materno</p><p>8. Fec. Nacimiento</p><p>9. Est. Civil</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">CONTACTO</p>
                                                <p>10. Comuna</p><p>11. Dirección</p><p>12. Email</p><p>13. Teléfono</p><p>14. WhatsApp</p>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">EMERGENCIA</p>
                                                <p>15. Nombre Emergencia</p><p>16. Teléf. Emergencia</p>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">BANCO NAC.</p>
                                                <p>17. Cód. Banco</p><p>18. Tipo Cuenta</p><p>19. Nº Cuenta</p>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-blue-500 mb-1 border-b border-blue-100">LABORAL / INT.</p>
                                                <p>20-23. Datos Inter.</p><p>24. Cargo</p><p>25. Depto.</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <a
                                                href="/plantilla_importacion.xlsx"
                                                download
                                                className="flex items-center gap-2 text-[12px] font-black text-[#5340FF] hover:text-[#4330E0] transition-colors bg-white px-4 py-2 rounded-xl border border-blue-100 shadow-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                DESCARGAR PLANTILLA EXCEL
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-[#EAECF0] hover:border-[#5340FF] hover:bg-[#F9FAFB] transition-all rounded-3xl p-12 text-center cursor-pointer group"
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                    />
                                    <div className="w-16 h-16 bg-[#F3F4F8] group-hover:bg-[#EEF2FF] rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                                        <svg className="w-8 h-8 text-[#9CA3AF] group-hover:text-[#5340FF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-[16px] font-black text-[#111827] mb-1">Cargar Archivo Excel del Maestro</h3>
                                    <p className="text-[13px] font-medium text-[#6B7280]">Selecciona el archivo con los expedientes completos</p>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-[#F9FAFB] p-5 rounded-2xl border border-[#EAECF0]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-black text-[#111827]">Vista Previa de Carga: {fileName}</h4>
                                            <p className="text-[12px] font-bold text-[#6B7280]">Se detectaron {preview.length} expedientes completos para procesar</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setStep(1); setPreview([]); setFileName(''); }}
                                        className="bg-white border border-[#EAECF0] text-[#6B7280] px-4 py-2 rounded-xl text-[12px] font-black hover:bg-gray-50 transition shadow-sm uppercase tracking-wider"
                                    >
                                        Cambiar Archivo
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-[#EAECF0] rounded-2xl shadow-sm">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-[#F9FAFB] text-left border-b border-[#EAECF0]">
                                                <th className="px-5 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Identidad</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Apellidos y Nombres</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Contacto / Email</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Cargo / Área</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest text-center">Datos Banc.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EAECF0]">
                                            {preview.map((w, i) => (
                                                <tr key={i} className="text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors">
                                                    <td className="px-5 py-4">
                                                        <p className="font-mono text-[11px] font-bold text-[#111827]">{w.rut || w.pasaporte || 'No ID'}</p>
                                                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">{w.nacionalidad}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="font-black text-[#111827] text-[13px]">{w.apellido_paterno} {w.apellido_materno}</p>
                                                        <p className="font-medium text-[#6B7280]">{w.nombres}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="font-bold text-[#111827]">{w.email}</p>
                                                        <p className="text-[11px] font-medium text-[#9CA3AF]">{w.phone}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="bg-[#EEF2FF] text-[#5340FF] px-2.5 py-1 rounded-lg font-black text-[10px] inline-block mb-1">{w.position || 'SIN CARGO'}</p>
                                                        <p className="text-[10px] font-bold text-[#6B7280] ml-1 uppercase">{w.department || 'GENERAL'}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {w.cta_bancaria || w.beneficiario_cta_abono ? (
                                                            <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[#F3F4F6]">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={processing}
                                        className="bg-[#10B981] hover:bg-[#059669] text-white px-12 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 flex items-center gap-4 group active:scale-[0.98]"
                                    >
                                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                        {processing ? 'Sincronizando expedientes...' : 'Cargar en Base de Datos'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
