import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-[#F3F4F8]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#5340FF]/5 to-transparent -z-10 pointer-events-none" />
            <div className="fixed -top-24 -right-24 w-96 h-96 bg-[#5340FF]/5 rounded-full blur-3xl -z-10" />
            <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

            <div className="mb-8">
                <Link href="/">
                    <ApplicationLogo className="w-auto h-12" />
                </Link>
            </div>

            <div className="w-full sm:max-w-md mt-6 px-10 py-12 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#EAECF0] sm:rounded-[24px] overflow-hidden transition-all">
                {children}
            </div>

            <p className="mt-8 text-[12px] font-medium text-[#9CA3AF] uppercase tracking-widest">
                &copy; 2026 DocDrive &bull; Control Documental
            </p>
        </div>
    );
}
