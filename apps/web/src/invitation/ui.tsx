import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function CopyButton({ text, toastMsg, className = '' }: { text: string; toastMsg: string; className?: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older WebViews without the async clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setDone(true);
    toast.success(toastMsg);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={onCopy} className={`btn btn-ghost !px-4 !py-2 text-sm ${className}`}>
      {done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {done ? t('copied') : t('copy')}
    </button>
  );
}

/** Accessible modal built on <dialog>; traps focus natively and closes on Esc/backdrop. */
export function Modal({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgb(30_20_35/0.55)] backdrop:backdrop-blur-sm"
    >
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative p-6">
            <button type="button" onClick={onClose} aria-label={t('close')} className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-primary-soft">
              <X size={18} aria-hidden />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

/**
 * Bottom sheet on phones, centred card on wider screens. Same <dialog> base as
 * Modal (native focus trap, Esc, backdrop click); the body scrolls on its own.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    document.body.classList.toggle('scroll-locked', open);
    return () => document.body.classList.remove('scroll-locked');
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      // Lenis would otherwise swallow wheel events meant for the sheet body.
      data-lenis-prevent
      className="mx-auto mb-0 mt-auto max-h-[90svh] w-full max-w-[30rem] overflow-hidden rounded-t-[2rem] bg-bg p-0 text-ink shadow-2xl backdrop:bg-[rgb(30_20_35/0.5)] backdrop:backdrop-blur-sm sm:mb-auto sm:max-w-[28rem] sm:rounded-[2rem]"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="flex max-h-[90svh] flex-col"
          >
            <div className="relative shrink-0 px-6 pb-3 pt-3 text-center">
              <span aria-hidden className="mx-auto mb-3 block h-1.5 w-11 rounded-full bg-ink/15 sm:hidden" />
              <h3 className="display-italic text-[1.9rem] leading-tight">{title}</h3>
              <button type="button" onClick={onClose} aria-label={t('close')} className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-primary-soft">
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

export function SegmentedChoice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length > 3 ? 2 : options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl border px-2 py-3 text-sm transition-colors ${active ? 'border-primary-strong bg-primary-strong text-white' : 'border-line bg-surface/70 text-ink hover:bg-primary-soft'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
