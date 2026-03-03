import { Head, Link } from '@inertiajs/react';

export default function Welcome({ auth }) {
    return (
        <div className="min-h-screen bg-[#0F172A] text-white selection:bg-[#5340FF] selection:text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Head title="Control Documental Inteligente" />

            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5340FF]/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Navigation */}
            <header className="fixed top-0 left-0 w-full z-50 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#5340FF] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                            </svg>
                        </div>
                        <span className="text-[20px] font-black tracking-tighter uppercase">DocDrive</span>
                    </div>

                    <nav className="flex items-center gap-8">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="h-11 px-6 bg-white text-[#0F172A] text-[13px] font-bold rounded-full flex items-center hover:bg-gray-100 transition shadow-xl"
                            >
                                Ir al Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href={route('login')} className="text-[13px] font-bold text-gray-400 hover:text-white transition">Acceder</Link>
                                <Link
                                    href={route('register')}
                                    className="h-11 px-6 bg-[#5340FF] text-white text-[13px] font-bold rounded-full flex items-center hover:bg-[#4A39E0] transition shadow-lg shadow-indigo-500/20"
                                >
                                    Solicitar Demo
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <main className="pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
                        <span className="w-2 h-2 rounded-full bg-[#5340FF] animate-pulse" />
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-300">Impulsado por Gemini 2.5 AI</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8">
                        Control Documental <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818CF8] via-[#5340FF] to-[#C084FC]">
                            Sin Errores Humanos
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl font-medium leading-relaxed mb-12">
                        Automatiza la validación de exámenes de salud, sincronización con Google Drive y análisis inteligente de anomalías en segundos.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href={route('register')}
                            className="w-full sm:w-auto h-16 px-10 bg-[#5340FF] text-white text-[15px] font-black rounded-2xl flex items-center justify-center hover:bg-[#4A39E0] transition shadow-2xl shadow-indigo-500/30 group"
                        >
                            Empezar Ahora
                            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </Link>
                        <button className="w-full sm:w-auto h-16 px-10 bg-white/5 text-white text-[15px] font-black rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
                            Ver Video Demo
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-24 pt-12 border-t border-white/5">
                        <div>
                            <p className="text-3xl font-black mb-1">99.9%</p>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Precisión AI</p>
                        </div>
                        <div>
                            <p className="text-3xl font-black mb-1">10k+</p>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Docs Procesados</p>
                        </div>
                        <div>
                            <p className="text-3xl font-black mb-1">&lt;2s</p>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Tiempo Respuesta</p>
                        </div>
                        <div>
                            <p className="text-3xl font-black mb-1">24/7</p>
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Disponibilidad</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Preview */}
                <div className="max-w-6xl mx-auto mt-32 relative group">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent z-10" />
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-[#5340FF] rounded-[40px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-[#1E293B] rounded-[36px] overflow-hidden border border-white/10 shadow-2xl">
                        <div className="h-10 border-b border-white/5 flex items-center px-6 gap-2 bg-[#0F172A]/50">
                            <div className="w-3 h-3 rounded-full bg-red-400/20" />
                            <div className="w-3 h-3 rounded-full bg-amber-400/20" />
                            <div className="w-3 h-3 rounded-full bg-emerald-400/20" />
                        </div>
                        <div className="p-4 sm:p-12">
                            <div className="bg-[#0F172A] rounded-2xl border border-white/5 p-8 flex flex-col md:flex-row gap-8 items-center justify-between">
                                <div className="space-y-4 max-w-md">
                                    <h3 className="text-2xl font-bold tracking-tight text-white">Gestión de Proyectos y Faenas</h3>
                                    <p className="text-gray-400 font-medium">Visualiza el estado de cumplimiento documental en tiempo real para todos tus proyectos de minería y construcción.</p>
                                    <Link href={route('register')} className="inline-flex items-center text-[#5340FF] font-black text-sm uppercase tracking-widest hover:gap-3 transition-all">
                                        Tour de la plataforma <span className="ml-2">→</span>
                                    </Link>
                                </div>
                                <div className="bg-[#1E293B] p-4 rounded-xl border border-white/5 shadow-inner">
                                    <div className="flex gap-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-16 h-24 bg-[#5340FF]/20 rounded-md border border-white/5 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-20 border-t border-white/5 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3 grayscale opacity-60">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                            </svg>
                        </div>
                        <span className="text-[15px] font-black tracking-tighter uppercase mb-0.5">DocDrive</span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Control Documental Inteligente &copy; 2026. Todos los derechos reservados.</p>
                    <div className="flex gap-8">
                        <a href="#" className="text-[12px] font-bold text-gray-500 hover:text-white transition uppercase tracking-widest">Privacidad</a>
                        <a href="#" className="text-[12px] font-bold text-gray-500 hover:text-white transition uppercase tracking-widest">Términos</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
