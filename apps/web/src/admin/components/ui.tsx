import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-[2rem] leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'yes' | 'no' | 'maybe' | 'neutral' | 'warn'; children: ReactNode }) {
  const cls = {
    yes: 'bg-[#3d8a5a]/12 text-[#2f6e47]',
    maybe: 'bg-[#c08a1e]/14 text-[#8a6212]',
    no: 'bg-[#c2456a]/12 text-[#9c3353]',
    warn: 'bg-[#c08a1e]/14 text-[#8a6212]',
    neutral: 'bg-line text-muted',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

/** Native <dialog> modal for admin forms. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto max-h-[90dvh] rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40`}
      style={{ width: `min(94vw, ${wide ? '48rem' : '30rem'})` }}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-line" aria-label="Close">
              <X size={18} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function confirmAction(message: string) {
  return window.confirm(message);
}
