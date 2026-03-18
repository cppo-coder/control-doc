const fs = require('fs');
const file = '/Users/beagle/Documents/Control-doc/resources/js/Pages/Workers/Checklist.jsx';
let content = fs.readFileSync(file, 'utf8');

const start = content.indexOf('<div className="py-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-full">');
const endMarker = '</td>';
let end = content.indexOf(endMarker, start);
if (start === -1 || end === -1) {
    console.error("Could not find start or end bounds.");
    process.exit(1);
}

const newContent = `<div className="flex flex-wrap items-center gap-y-1 gap-x-6 py-1.5 w-[95%] mx-auto overflow-hidden">
                                                    <div className="flex items-center gap-1.5 shrink-0 border-r border-slate-200 pr-4 my-1">
                                                        <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Documentación</span>
                                                    </div>
                                                    {worker.checklist.map((docEntry) => {
                                                        const estado = docEntry.estado;
                                                        const cardCls = estado === 'vigente' ? 'border-emerald-100 bg-emerald-50/50' :
                                                            estado === 'por_vencer' ? 'border-amber-100 bg-amber-50/50' :
                                                                estado === 'vencido' ? 'border-red-100 bg-red-50/50' :
                                                                    'border-[#EAECF0] bg-white';
                                                        const iconCls = estado === 'vigente' ? 'bg-emerald-100 text-emerald-600' :
                                                            estado === 'por_vencer' ? 'bg-amber-100 text-amber-600' :
                                                                estado === 'vencido' ? 'bg-red-100 text-red-600' :
                                                                    'bg-[#F3F4F8] text-[#9CA3AF]';
                                                        return (
                                                            <div key={docEntry.tipo}
                                                                className={\`flex items-center gap-1.5 p-1 pr-1.5 rounded border shadow-sm transition-all hover:shadow-md group/card \${cardCls} h-7 shrink-0\`}>
                                                                
                                                                {/* Mini Icono Encapsulado */}
                                                                <div className={\`w-5 h-5 rounded flex items-center justify-center shrink-0 \${iconCls}\`}>
                                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                                    </svg>
                                                                </div>

                                                                <div className="flex flex-col justify-center min-w-[60px] max-w-[120px]">
                                                                    <p className="text-[9px] font-black text-[#1F2937] truncate leading-none uppercase tracking-tight" title={docEntry.label}>
                                                                        {docEntry.label.replace('Examen ', 'Ex. ').replace(' de Contrato', '')}
                                                                    </p>
                                                                    {docEntry.resultado_ia?.imc && (
                                                                        <span className={\`text-[7px] font-bold max-w-max leading-none mt-0.5 px-0.5 rounded-sm \${docEntry.resultado_ia.imc.alerta ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}\`}>
                                                                            IMC {docEntry.resultado_ia.imc.valor}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Acciones Compactas */}
                                                                <div className="flex items-center gap-0.5 border-l border-black/5 pl-1 shrink-0 ml-auto">
                                                                    {docEntry.archivo_referencia ? (
                                                                        <a href={\`/storage/google/\${docEntry.archivo_referencia}\`} target="_blank"
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="w-4 h-4 rounded hover:bg-white text-indigo-600 flex items-center justify-center transition-colors"
                                                                            title="Ver PDF">
                                                                            <IconLink c="w-2.5 h-2.5" />
                                                                        </a>
                                                                    ) : (
                                                                        <button onClick={() => openModal(worker, docEntry)}
                                                                            className="w-4 h-4 rounded hover:bg-white text-slate-400 flex items-center justify-center transition-colors"
                                                                            title="Subir / Pendiente">
                                                                            <IconPlus c="w-2.5 h-2.5" />
                                                                        </button>
                                                                    )}
                                                                    
                                                                    <button onClick={() => openModal(worker, docEntry)}
                                                                        className="w-4 h-4 rounded hover:bg-white text-slate-500 flex items-center justify-center transition-colors opacity-0 group-hover/card:opacity-100">
                                                                        <IconEdit c="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            `;

fs.writeFileSync(file, content.substring(0, start) + newContent + content.substring(end));
console.log("Resto successful.");
