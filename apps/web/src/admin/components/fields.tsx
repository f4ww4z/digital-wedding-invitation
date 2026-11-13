import { useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Music, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { LText, MediaItem } from '@wedding/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { at, adminErrorMessage } from '../i18n';
import { useAdminQuery } from '../hooks';
import { Dialog } from './ui';
import { fileFromUrl, useImageEditor, type EditOptions } from '../imageEditor/context';

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: (id: string) => ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className="text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5">{children(id)}</div>
      {error && <p className="mt-1 text-xs text-[#9c3353]">{error}</p>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  max,
  placeholder,
  type = 'text',
  multiline,
  rows = 3,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  max?: number;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <textarea id={id} className="field" rows={rows} maxLength={max} value={value} placeholder={placeholder} dir={dir} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input id={id} className="field" type={type} maxLength={max} value={value} placeholder={placeholder} dir={dir} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
}

export function NumberField({ label, value, onChange, min, max, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className="field" type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />}
    </Field>
  );
}

/** Indonesian + English side by side (stacked on phones). */
export function LField({ label, value, onChange, multiline, rows, hint, max }: { label: string; value: LText; onChange: (v: LText) => void; multiline?: boolean; rows?: number; hint?: string; max?: number }) {
  const idId = useId();
  const enId = useId();
  const Input = multiline ? 'textarea' : 'input';
  return (
    <fieldset className="text-sm">
      <legend className="font-medium">{label}</legend>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5 grid gap-2 md:grid-cols-2">
        <div className="relative">
          <label htmlFor={idId} className="pointer-events-none absolute right-2.5 top-2 rounded bg-line px-1.5 text-[0.65rem] font-medium text-muted">
            ID
          </label>
          <Input id={idId} className="field !pr-10" rows={rows} maxLength={max} value={value.id} onChange={(e) => onChange({ ...value, id: e.target.value })} />
        </div>
        <div className="relative">
          <label htmlFor={enId} className="pointer-events-none absolute right-2.5 top-2 rounded bg-line px-1.5 text-[0.65rem] font-medium text-muted">
            EN
          </label>
          <Input id={enId} className="field !pr-10" rows={rows} maxLength={max} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
        </div>
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-line'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('fields');
  return (
    <Field label={label}>
      {(id) => (
        <div className="flex items-center gap-2">
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-1" />
          <input className="field font-mono !text-xs" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-label={t('hexValue', { label })} />
        </div>
      )}
    </Field>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/* ---------------- Media ---------------- */

export async function uploadFile(file: File): Promise<MediaItem> {
  const fd = new FormData();
  fd.append('file', file);
  return api<MediaItem>('/api/admin/media', { method: 'POST', body: fd });
}

/**
 * Upload files one by one. Images open in the editor first (crop, rotate, colour);
 * cancelling the editor stops the rest of the batch.
 */
export function useUpload(onDone?: (m: MediaItem) => void, editOptions?: EditOptions) {
  const qc = useQueryClient();
  const edit = useImageEditor();
  const [busy, setBusy] = useState(false);
  const run = async (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy(true);
    let uploaded = 0;
    try {
      for (const [i, f] of list.entries()) {
        const ready = f.type.startsWith('image/') ? await edit(f, { ...editOptions, queue: { index: i + 1, total: list.length } }) : f;
        if (!ready) break;
        const m = await uploadFile(ready);
        uploaded++;
        onDone?.(m);
      }
      if (uploaded) toast.success(uploaded > 1 ? at('fields:uploadedMany', { n: uploaded }) : at('fields:uploadedOne'));
    } catch (e) {
      toast.error(adminErrorMessage(e));
    } finally {
      setBusy(false);
      if (uploaded) void qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    }
  };
  /** Edit an already-uploaded image; the result is saved as a new file. */
  const editExisting = async (url: string) => {
    let file: File;
    try {
      file = await fileFromUrl(url);
    } catch (e) {
      toast.error(adminErrorMessage(e));
      return;
    }
    await run([file]);
  };
  return { run, editExisting, busy };
}

function MediaPicker({ open, onClose, kind, onPick, editOptions }: { open: boolean; onClose: () => void; kind: 'image' | 'audio'; onPick: (url: string) => void; editOptions?: EditOptions }) {
  const { t } = useTranslation('fields');
  const media = useAdminQuery<MediaItem[]>('media', '/api/admin/media');
  const input = useRef<HTMLInputElement>(null);
  const up = useUpload((m) => {
    if (m.kind === kind) {
      onPick(m.url);
      onClose();
    }
  }, editOptions);
  const items = (media.data ?? []).filter((m) => m.kind === kind);
  return (
    <Dialog open={open} onClose={onClose} title={kind === 'image' ? t('chooseImage') : t('chooseAudio')} wide>
      <button type="button" className="btn btn-primary w-full" onClick={() => input.current?.click()} disabled={up.busy}>
        <Upload size={18} aria-hidden /> {up.busy ? t('uploading') : kind === 'image' ? t('uploadImage') : t('uploadAudio')}
      </button>
      <input ref={input} type="file" className="hidden" accept={kind === 'image' ? 'image/jpeg,image/png,image/webp,image/avif,image/heic' : 'audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/wav'} onChange={(e) => {
          void up.run(e.target.files);
          e.target.value = '';
        }}
      />
      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">{t('nothingUploaded')}</p>
      ) : (
        <ul className={`mt-4 grid max-h-[50dvh] gap-2 overflow-auto ${kind === 'image' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1'}`}>
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(m.url);
                  onClose();
                }}
                className="block w-full overflow-hidden rounded-xl border border-line text-left hover:border-primary"
              >
                {m.kind === 'image' ? (
                  <img src={m.url} alt={m.originalName} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex items-center gap-2 p-3 text-sm">
                    <Music size={16} aria-hidden /> {m.originalName || m.url}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** URL field with picker/upload. Also accepts pasted https:// URLs or site paths. */
export function MediaField({
  label,
  value,
  onChange,
  kind = 'image',
  hint,
  editor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind?: 'image' | 'audio';
  hint?: string;
  /** How the photo is shown on the invitation, so the editor can suggest the right crop. */
  editor?: EditOptions;
}) {
  const { t } = useTranslation('fields');
  const [open, setOpen] = useState(false);
  const up = useUpload((m) => m.kind === 'image' && onChange(m.url), editor);
  const editable = kind === 'image' && value.startsWith('/media/');
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-center gap-2">
          {kind === 'image' &&
            (value ? (
              <img src={value} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-muted" aria-hidden>
                <ImagePlus size={18} />
              </span>
            ))}
          <input id={id} className="field min-w-0 flex-1 !text-xs" value={value} placeholder={t('urlPlaceholder')} onChange={(e) => onChange(e.target.value)} />
          {editable && (
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-muted hover:bg-line disabled:opacity-40"
              aria-label={t('editLabel', { label })}
              title={t('editTitle')}
              disabled={up.busy}
              onClick={() => void up.editExisting(value)}
            >
              <Pencil size={16} aria-hidden />
            </button>
          )}
          <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-2 text-sm" onClick={() => setOpen(true)}>
            {t('choose')}
          </button>
          {value && (
            <button type="button" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-line" aria-label={t('clearLabel', { label })} onClick={() => onChange('')}>
              <X size={16} aria-hidden />
            </button>
          )}
          <MediaPicker open={open} onClose={() => setOpen(false)} kind={kind} onPick={onChange} editOptions={editor} />
        </div>
      )}
    </Field>
  );
}

/* ---------------- Arrays ---------------- */

export function ListEditor<T>({
  items,
  onChange,
  render,
  make,
  addLabel,
  itemLabel,
  max,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (v: T) => void, index: number) => ReactNode;
  make: () => T;
  addLabel: string;
  itemLabel: (item: T, i: number) => string;
  max?: number;
}) {
  const { t } = useTranslation('fields');
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border border-line bg-bg/50 p-4">
          <div className="mb-3 flex items-center gap-1">
            <p className="mr-auto min-w-0 truncate text-sm font-medium text-muted">{itemLabel(it, i)}</p>
            <button type="button" className="rounded-full p-1.5 text-muted hover:bg-line disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp')}>
              <ArrowUp size={16} aria-hidden />
            </button>
            <button type="button" className="rounded-full p-1.5 text-muted hover:bg-line disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown')}>
              <ArrowDown size={16} aria-hidden />
            </button>
            <button type="button" className="rounded-full p-1.5 text-[#9c3353] hover:bg-line" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('removeItem', { label: itemLabel(it, i) })}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-4">{render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}</div>
        </div>
      ))}
      {(!max || items.length < max) && (
        <button type="button" className="btn btn-ghost self-start !py-2 text-sm" onClick={() => onChange([...items, make()])}>
          <Plus size={16} aria-hidden /> {addLabel}
        </button>
      )}
    </div>
  );
}
