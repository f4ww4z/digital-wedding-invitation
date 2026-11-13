import { useRef, useState, type DragEvent } from 'react';
import { Copy, Music, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaItem } from '@wedding/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { at, adminIntlLocale } from '../i18n';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { confirmAction, Empty, PageHeader } from '../components/ui';
import { useUpload } from '../components/fields';

const kb = (n: number) => (n > 1024 * 1024 ? `${new Intl.NumberFormat(adminIntlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 1024 / 1024)} MB` : `${Math.round(n / 1024)} KB`);

export default function Media() {
  const { t } = useTranslation('media');
  const q = useAdminQuery<MediaItem[]>('media', '/api/admin/media');
  const up = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const remove = useAdminMutation((id: number) => api(`/api/admin/media/${id}`, { method: 'DELETE' }), { invalidate: ['media'], success: t('deleted') });
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void up.run(e.dataTransfer.files);
  };
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        disabled={up.busy}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-sm transition-colors ${over ? 'border-primary bg-primary-soft' : 'border-line text-muted hover:border-primary/60'}`}
      >
        <Upload size={24} aria-hidden />
        {up.busy ? t('uploading') : t('drop')}
      </button>
      <input ref={input} type="file" multiple className="hidden" accept="image/*,audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/wav" onChange={(e) => {
          void up.run(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="mt-6">
        {q.isLoading ? (
          <p className="text-sm text-muted">{t('loading')}</p>
        ) : !q.data?.length ? (
          <Empty>{t('empty')}</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {q.data.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                {m.kind === 'image' ? (
                  <img src={m.url} alt={m.originalName} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-primary-soft p-3 text-primary-strong">
                    <Music size={28} aria-hidden />
                    <audio src={m.url} controls preload="none" className="w-full" />
                  </div>
                )}
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium" title={m.originalName}>
                    {m.originalName || t('fileFallback')}
                  </p>
                  <p className="text-[0.65rem] text-muted">
                    {kb(m.size)}
                    {m.width ? ` · ${m.width}×${m.height}` : ''} · {fmtDate(m.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost flex-1 !px-2 !py-1.5 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(m.url);
                        toast.success(at('media:urlCopied'));
                      }}
                    >
                      <Copy size={13} aria-hidden /> URL
                    </button>
                    {m.kind === 'image' && (
                      <button
                        type="button"
                        className="btn btn-ghost !px-2 !py-1.5 text-xs"
                        aria-label={t('editLabel', { name: m.originalName })}
                        title={t('editTitle')}
                        disabled={up.busy}
                        onClick={() => void up.editExisting(m.url)}
                      >
                        <Pencil size={13} aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost !px-2 !py-1.5 text-xs text-[#9c3353]"
                      aria-label={t('deleteLabel', { name: m.originalName })}
                      onClick={() => confirmAction(t('deleteConfirm')) && remove.mutate(m.id)}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
