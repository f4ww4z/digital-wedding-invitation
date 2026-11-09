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
