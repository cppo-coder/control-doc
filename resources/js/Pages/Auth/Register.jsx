import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Registrarse" />

            <div className="mb-8">
                <h1 className="text-[28px] font-black text-[#111827] tracking-tight text-center">Crear Cuenta</h1>
                <p className="text-[#6B7280] text-[14px] font-medium text-center mt-1">Únete a la nueva era del Control Documental</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                    <input
                        id="name"
                        type="text"
                        value={data.name}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="Ej. Juan Pérez"
                        onChange={(e) => setData('name', e.target.value)}
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 ml-1">Email Corporativo</label>
                    <input
                        id="email"
                        type="email"
                        value={data.email}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="juan@empresa.com"
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
                    <input
                        id="password"
                        type="password"
                        value={data.password}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="Mínimo 8 caracteres"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 ml-1">Confirmar Contraseña</label>
                    <input
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="Repite tu contraseña"
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                    <InputError message={errors.password_confirmation} className="mt-2" />
                </div>

                <div className="pt-4">
                    <button
                        className="w-full h-[52px] bg-[#5340FF] hover:bg-[#4A39E0] text-white text-[13px] font-extrabold uppercase tracking-[0.08em] rounded-[18px] transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        disabled={processing}
                    >
                        {processing && (
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        Crear Cuenta Ahora
                    </button>
                </div>

                <div className="text-center pt-2">
                    <p className="text-[13px] font-semibold text-[#6B7280]">
                        ¿Ya tienes una cuenta? {' '}
                        <Link href={route('login')} className="text-[#5340FF] font-bold hover:underline transition">Inicia Sesión</Link>
                    </p>
                </div>
            </form>
        </GuestLayout>
    );
}
