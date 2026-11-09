import { useRef, useState, type DragEvent } from 'react';
import { Copy, Music, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaItem } from '@sakinah/shared';
import { api } from '../../lib/api';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { confirmAction, Empty, PageHeader } from '../components/ui';
import { useUpload } from '../components/fields';

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function Media() {
  const q = useAdminQuery<MediaItem[]>('media', '/api/admin/media');
  const up = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const remove = useAdminMutation((id: number) => api(`/api/admin/media/${id}`, { method: 'DELETE' }), { invalidate: ['media'], success: 'File deleted' });
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void up.run(e.dataTransfer.files);
  };
  return (
    <>
      <PageHeader
        title="Media"
        description="Photos are resized and converted to WebP automatically, with location data removed. Audio: MP3, OGG, M4A or WAV."
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
        {up.busy ? 'Uploading…' : 'Drop files here or tap to upload'}
      </button>
      <input ref={input} type="file" multiple className="hidden" accept="image/*,audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,audio/wav" onChange={(e) => void up.run(e.target.files)} />

      <div className="mt-6">
        {q.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !q.data?.length ? (
          <Empty>No files yet.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {q.data.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                {m.kind === 'image' ? (
                  <img src={m.url} alt={m.originalName} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-primary-soft p-3 text-primary">
                    <Music size={28} aria-hidden />
                    <audio src={m.url} controls preload="none" className="w-full" />
                  </div>
                )}
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium" title={m.originalName}>
                    {m.originalName || 'file'}
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
                        toast.success('URL copied');
                      }}
                    >
                      <Copy size={13} aria-hidden /> URL
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost !px-2 !py-1.5 text-xs text-[#9c3353]"
                      aria-label={`Delete ${m.originalName}`}
                      onClick={() => confirmAction('Delete this file? Anything using it will show a broken image.') && remove.mutate(m.id)}
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
