import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ header, children }) {
    const { props, url } = usePage();
    const user = props.auth.user;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [personalMenuOpen, setPersonalMenuOpen] = useState(route().current('workers.*'));
    const [shiftsMenuOpen, setShiftsMenuOpen] = useState(route().current('shifts.*'));
    const isProjectsOrCategories = route().current('projects.*') || url.includes('/categories');

    return (
        <div className="min-h-screen bg-[#F3F4F8] flex" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ── */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-white flex flex-col
                transition-transform duration-300
                ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
                lg:translate-x-0 lg:static lg:h-screen lg:shadow-none
                border-r border-[#EAECF0]
            `}>
                {/* Logo */}
                <div className="flex items-center gap-3 h-16 px-6 border-b border-[#EAECF0] shrink-0">
                    <div className="w-8 h-8 bg-[#5340FF] rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                    </div>
                    <span className="text-[16px] font-extrabold text-[#111827] tracking-tight">DocDrive</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <p className="px-3 mb-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.12em]">Menú</p>

                    <Link
                        href={route('dashboard')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${route().current('dashboard')
                            ? 'bg-[#EEF2FF] text-[#5340FF]'
                            : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                            }`}
                    >
                        <svg className={`w-[18px] h-[18px] shrink-0 ${route().current('dashboard') ? 'text-[#5340FF]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                            <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                            <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                            <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                        </svg>
                        Dashboard
                    </Link>

                    <Link
                        href={route('projects.index')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${isProjectsOrCategories
                            ? 'bg-[#EEF2FF] text-[#5340FF]'
                            : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                            }`}
                    >
                        <svg className={`w-[18px] h-[18px] shrink-0 ${isProjectsOrCategories ? 'text-[#5340FF]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Archivos en Drive
                    </Link>

                    {/* Personal con Submenú (Acordeón) */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setPersonalMenuOpen(!personalMenuOpen)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-[#F9FAFB] group ${route().current('workers.*')
                                ? 'text-[#5340FF]'
                                : 'text-[#6B7280]'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <svg className={`w-[18px] h-[18px] shrink-0 ${route().current('workers.*') ? 'text-[#5340FF]' : 'text-[#9CA3AF] group-hover:text-[#111827]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Personal
                            </div>
                            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${personalMenuOpen ? 'rotate-180' : ''} ${route().current('workers.*') ? 'text-[#5340FF]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {personalMenuOpen && (
                            <div className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                <Link
                                    href={route('workers.index')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('workers.index')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Ficha de Registro
                                </Link>
                                <Link
                                    href={route('workers.master-list')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('workers.master-list')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Listado Maestro
                                </Link>
                                <Link
                                    href={route('workers.import')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('workers.import')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Importar trabajadores
                                </Link>
                                <Link
                                    href={route('workers.phone-directory')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('workers.phone-directory')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Agenda Telefónica
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Turnos con Submenú (Acordeón) */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setShiftsMenuOpen(!shiftsMenuOpen)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-[#F9FAFB] group ${route().current('shifts.*')
                                ? 'text-[#5340FF]'
                                : 'text-[#6B7280]'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <svg className={`w-[18px] h-[18px] shrink-0 ${route().current('shifts.*') ? 'text-[#5340FF]' : 'text-[#9CA3AF] group-hover:text-[#111827]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Turnos
                            </div>
                            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${shiftsMenuOpen ? 'rotate-180' : ''} ${route().current('shifts.*') ? 'text-[#5340FF]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {shiftsMenuOpen && (
                            <div className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                <Link
                                    href={route('shifts.index')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('shifts.index')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Programación
                                </Link>
                                <Link
                                    href={route('shifts.groups.index')}
                                    className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${route().current('shifts.groups.index')
                                        ? 'bg-[#EEF2FF] text-[#5340FF]'
                                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                                        }`}
                                >
                                    Crear Grupo (Turno)
                                </Link>
                            </div>
                        )}
                    </div>

                    <Link
                        href={route('courses.index')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${route().current('courses.*')
                            ? 'bg-[#EEF2FF] text-[#5340FF]'
                            : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                            }`}
                    >
                        <svg className={`w-[18px] h-[18px] shrink-0 ${route().current('courses.*') ? 'text-[#5340FF]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Cursos
                    </Link>
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-[#EAECF0] shrink-0">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#F9FAFB] transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[#EEF2FF] flex items-center justify-center">
                            <span className="text-[#5340FF] text-[11px] font-extrabold uppercase">{user.name?.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-[#111827] truncate">{user.name}</p>
                            <p className="text-[11px] text-[#9CA3AF] truncate">{user.email}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

                {/* Top Bar */}
                <header className="h-16 bg-white border-b border-[#EAECF0] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F8] transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        {/* Search */}
                        <div className="hidden sm:flex items-center gap-2 bg-[#F3F4F8] rounded-xl px-3 py-2 w-64">
                            <svg className="w-4 h-4 text-[#9CA3AF] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="bg-transparent text-[13px] text-[#374151] placeholder-[#9CA3AF] focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Bell */}
                        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[#F3F4F8] text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#5340FF] transition">
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full border-2 border-white"></span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>

                        {/* User dropdown */}
                        <Dropdown>
                            <Dropdown.Trigger>
                                <span className="flex items-center gap-2.5 cursor-pointer">
                                    <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                                        <span className="text-[#5340FF] text-[12px] font-extrabold uppercase">{user.name?.charAt(0)}</span>
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-[12px] font-bold text-[#111827] leading-none">{user.name}</p>
                                        <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-none">Admin</p>
                                    </div>
                                    <svg className="hidden sm:block w-4 h-4 text-[#9CA3AF]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </Dropdown.Trigger>
                            <Dropdown.Content align="right" width="48">
                                <Dropdown.Link href={route('profile.edit')}>Mi Perfil</Dropdown.Link>
                                <Dropdown.Link href={route('logout')} method="post" as="button">
                                    Cerrar Sesión
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-8">
                        {header && <div className="mb-6">{header}</div>}
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
