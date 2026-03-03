import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Iniciar Sesión" />

            <div className="mb-8">
                <h1 className="text-[28px] font-black text-[#111827] tracking-tight text-center">Bienvenido</h1>
                <p className="text-[#6B7280] text-[14px] font-medium text-center mt-1">Accede a tu plataforma de Control Documental</p>
            </div>

            {status && (
                <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-[13px] font-bold">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5 ml-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={data.email}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="tu@correo.com"
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                        <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest">Contraseña</label>
                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-[11px] font-bold text-[#5340FF] hover:text-[#4A39E0] transition underline"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        )}
                    </div>
                    <input
                        id="password"
                        type="password"
                        value={data.password}
                        required
                        className="w-full px-5 py-3.5 rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] text-[14px] font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#5340FF]/20 focus:border-[#5340FF] transition-all"
                        placeholder="••••••••"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="flex items-center gap-3 px-1 py-1">
                    <Checkbox
                        name="remember"
                        checked={data.remember}
                        className="w-4 h-4 rounded-md border-[#EAECF0] text-[#5340FF] focus:ring-[#5340FF]/30 transition"
                        onChange={(e) => setData('remember', e.target.checked)}
                    />
                    <span className="text-[13px] font-bold text-[#374151]">Recordarme</span>
                </div>

                <div className="pt-2">
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
                        Ingresar Ahora
                    </button>
                </div>

                <div className="text-center pt-2">
                    <p className="text-[13px] font-semibold text-[#6B7280]">
                        ¿No tienes una cuenta? {' '}
                        <Link href={route('register')} className="text-[#5340FF] font-bold hover:underline transition">Regístrate gratis</Link>
                    </p>
                </div>
            </form>
        </GuestLayout>
    );
}
