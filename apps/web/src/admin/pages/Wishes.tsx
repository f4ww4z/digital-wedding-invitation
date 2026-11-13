import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Download, EyeOff, Trash2 } from 'lucide-react';
import type { AdminWish } from '@wedding/shared';
import { api } from '../../lib/api';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { Badge, Card, confirmAction, Empty, PageHeader } from '../components/ui';
import { at } from '../i18n';

type Status = AdminWish['status'];

export default function Wishes() {
  const { t } = useTranslation('wishes');
  const q = useAdminQuery<AdminWish[]>('wishes', '/api/admin/wishes');
  const [filter, setFilter] = useState<Status | ''>('');
  const setStatus = useAdminMutation(({ id, status }: { id: number; status: Status }) => api(`/api/admin/wishes/${id}`, { method: 'PATCH', json: { status } }), {
    invalidate: ['wishes'],
    success: at('wishes:updated'),
  });
  const remove = useAdminMutation((id: number) => api(`/api/admin/wishes/${id}`, { method: 'DELETE' }), { invalidate: ['wishes'], success: at('wishes:deleted') });
  const list = useMemo(() => (q.data ?? []).filter((w) => !filter || w.status === filter), [q.data, filter]);
  const pending = (q.data ?? []).filter((w) => w.status === 'pending').length;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <a className="btn btn-ghost" href="/api/admin/wishes/export.csv">
            <Download size={18} aria-hidden /> {t('export')}
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t('filterLabel')}>
        {(['', 'pending', 'visible', 'hidden'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${filter === f ? 'border-primary bg-primary-soft' : 'border-line text-muted'}`}
          >
            {f ? t(`status.${f}`) : t('all')}
            {f === 'pending' && pending ? ` (${pending})` : ''}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted">{t('loading')}</p>
      ) : !list.length ? (
        <Empty>{filter ? t('emptyFiltered', { status: t(`status.${filter}`) }) : t('emptyYet')}</Empty>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((w) => (
            <li key={w.id}>
              <Card className={`h-full !p-4 ${w.status === 'hidden' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium">{w.name}</p>
                  {w.status === 'pending' && <Badge tone="warn">{t('waiting')}</Badge>}
                  {w.status === 'hidden' && <Badge>{t('hiddenBadge')}</Badge>}
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm text-ink/85">{w.message}</p>
                <div className="mt-3 flex items-center gap-1">
                  <span className="mr-auto text-xs text-muted">{fmtDate(w.createdAt)}</span>
                  {w.status !== 'visible' && (
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setStatus.mutate({ id: w.id, status: 'visible' })}>
                      <Check size={14} aria-hidden /> {t('show')}
                    </button>
                  )}
                  {w.status !== 'hidden' && (
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setStatus.mutate({ id: w.id, status: 'hidden' })}>
                      <EyeOff size={14} aria-hidden /> {t('hide')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost !px-3 !py-1.5 text-xs text-[#9c3353]"
                    aria-label={t('deleteAria', { name: w.name })}
                    onClick={() => confirmAction(t('confirmDelete')) && remove.mutate(w.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
