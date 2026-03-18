const fs = require('fs');
const file = '/Users/beagle/Documents/Control-doc/resources/js/Pages/Workers/Checklist.jsx';
let content = fs.readFileSync(file, 'utf8');
const start = content.indexOf('<div className="flex flex-wrap items-center gap-y-1 gap-x-6 py-1.5 w-[95%] mx-auto overflow-hidden">');
const end = content.indexOf('</td>', start);
const newContent = `
                                                <div className="py-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50/10 px-6">
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
                                                                onClick={() => openModal(worker, docEntry)}
                                                                className={\`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group/card \${cardCls}\`}>
                                                                
                                                                <div>
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className={\`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 \${iconCls}\`}>
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                                                            </svg>
                                                                        </div>
                                                                        
                                                                        {docEntry.archivo_referencia && (
                                                                            <a href={\`/storage/google/\${docEntry.archivo_referencia}\`} target="_blank"
                                                                                onClick={e => e.stopPropagation()}
                                                                                className="w-7 h-7 rounded-lg hover:bg-white text-indigo-600 flex items-center justify-center transition-colors shadow-sm bg-white/50"
                                                                                title="Ver PDF">
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                                            </a>
                                                                        )}
                                                                    </div>

                                                                    <p className="text-[11px] font-black text-[#374151] leading-tight mb-2">
                                                                        {docEntry.label}
                                                                    </p>

                                                                    <div className="mt-1">
                                                                        <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border \${
                                                                            estado === 'vigente' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                            estado === 'por_vencer' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                                            estado === 'vencido' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                            'bg-[#F3F4F8] text-[#9CA3AF] border-transparent'
                                                                        }\`}>
                                                                            {estado.replace('_', ' ')}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    {docEntry.tipo === 'anexo_contrato' && !docEntry.archivo_referencia && (
                                                                        <div className="mt-3 text-[9px] text-indigo-500 font-bold flex items-center gap-1">
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg> 
                                                                            Click para gestionar anexos
                                                                        </div>
                                                                    )}

                                                                    {(docEntry.resultado_ia?.imc || docEntry.resultado_ia?.resumen) && (
                                                                        <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                                                                            {docEntry.resultado_ia?.imc && (
                                                                                <div className="flex justify-between items-center bg-white/50 p-1.5 rounded-lg">
                                                                                    <span className="text-[9px] font-bold text-[#6B7280] uppercase">IMC</span>
                                                                                    <span className={\`text-[10px] font-black \${docEntry.resultado_ia.imc.alerta ? 'text-amber-600' : 'text-emerald-600'}\`}>
                                                                                        {docEntry.resultado_ia.imc.valor}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {docEntry.resultado_ia?.resumen && (
                                                                                <p className="text-[9px] text-[#6B7280] italic leading-tight line-clamp-2" title={docEntry.resultado_ia.resumen}>
                                                                                    {docEntry.resultado_ia.resumen}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {!docEntry.multiple && docEntry.fecha_vencimiento && (
                                                                    <p className="text-[10px] text-[#9CA3AF] mt-3 border-t border-black/5 pt-2">
                                                                        Vence: {new Date(docEntry.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-CL')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            `;
fs.writeFileSync(file, content.substring(0, start) + newContent + content.substring(end));
