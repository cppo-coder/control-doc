import { useState, useCallback } from 'react';

/**
 * Hook + Modal de confirmación reutilizable.
 *
 * Uso:
 *   const { confirmModal, askConfirm } = useConfirm();
 *
 *   // En el JSX del componente:
 *   {confirmModal}
 *
 *   // Para disparar:
 *   askConfirm({
 *     title:   '¿Eliminar proyecto?',
 *     message: 'Esta acción no se puede deshacer.',
 *     variant: 'danger',          // 'danger' | 'warning' | 'default'
 *     confirmLabel: 'Eliminar',
 *     onConfirm: () => { ... },
 *   });
 */
export function useConfirm() {
    const [state, setState] = useState(null); // null = cerrado

    const askConfirm = useCallback((opts) => {
        setState(opts);
    }, []);

    const close = () => setState(null);

    const confirmModal = state ? (
        <ConfirmModal
            title={state.title ?? '¿Confirmar acción?'}
            message={state.message ?? ''}
            variant={state.variant ?? 'danger'}
            confirmLabel={state.confirmLabel ?? 'Confirmar'}
            cancelLabel={state.cancelLabel ?? 'Cancelar'}
            onConfirm={() => { close(); state.onConfirm?.(); }}
            onCancel={close}
        />
    ) : null;

    return { confirmModal, askConfirm };
}

/* ─── Variantes visuales ─── */
const VARIANTS = {
    danger: {
        icon: (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        iconBg: 'bg-red-50',
        btn: 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200',
    },
    warning: {
        icon: (
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        iconBg: 'bg-amber-50',
        btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200',
    },
    default: {
        icon: (
            <svg className="w-6 h-6 text-[#5340FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        iconBg: 'bg-[#EEF2FF]',
        btn: 'bg-[#5340FF] hover:bg-[#4330E0] text-white shadow-sm shadow-indigo-200',
    },
};

export default function ConfirmModal({
    title,
    message,
    variant = 'danger',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
}) {
    const v = VARIANTS[variant] ?? VARIANTS.danger;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B0F19]/60 backdrop-blur-[6px] transition-all duration-300"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] w-full max-w-sm border border-[#EAECF0] p-7 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon + Title */}
                <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${v.iconBg}`}>
                        {v.icon}
                    </div>
                    <div>
                        <h3 className="text-[15px] font-extrabold text-[#111827] leading-snug">{title}</h3>
                        {message && (
                            <p className="text-[13px] text-[#6B7280] mt-1 leading-relaxed">{message}</p>
                        )}
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="h-10 px-5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`h-10 px-5 text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition ${v.btn}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
