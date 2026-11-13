import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import type { AdminRsvp, Attendance } from '@wedding/shared';
import { api } from '../../lib/api';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { Badge, Card, confirmAction, Empty, PageHeader } from '../components/ui';

export default function Rsvps() {
  const { t } = useTranslation('rsvps');
  const q = useAdminQuery<AdminRsvp[]>('rsvps', '/api/admin/rsvps');
  const [filter, setFilter] = useState<Attendance | ''>('');
  const remove = useAdminMutation((id: number) => api(`/api/admin/rsvps/${id}`, { method: 'DELETE' }), { invalidate: ['rsvps', 'guests'], success: t('deleted') });
  const list = useMemo(() => (q.data ?? []).filter((r) => !filter || r.attendance === filter), [q.data, filter]);
  const pax = (q.data ?? []).filter((r) => r.attendance === 'yes').reduce((a, r) => a + r.pax, 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description', { pax, n: (q.data ?? []).filter((r) => r.attendance === 'yes').length })}
        actions={
          <a className="btn btn-ghost" href="/api/admin/rsvps/export.csv">
            <Download size={18} aria-hidden /> {t('export')}
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t('filter')}>
        {(['', 'yes', 'maybe', 'no'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm ${filter === f ? 'border-primary bg-primary-soft' : 'border-line text-muted'}`}
          >
            {f ? t(`attendance.${f}`) : t('all')} ({(q.data ?? []).filter((r) => !f || r.attendance === f).length})
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted">{t('loading')}</p>
      ) : !list.length ? (
        <Empty>{filter ? t('emptyFiltered') : t('empty')}</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((r) => (
            <li key={r.id}>
              <Card className="!p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {r.name}
                      {r.guestName && r.guestName !== r.name && <span className="ml-2 text-xs text-muted">({r.guestName})</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={r.attendance}>
                        {t(`attendance.${r.attendance}`)}
                        {r.attendance !== 'no' ? ` · ${r.pax}` : ''}
                      </Badge>
                      {!r.guestId && <Badge>{t('openLink')}</Badge>}
                      <span className="text-xs text-muted">{fmtDate(r.updatedAt)}</span>
                    </div>
                    {r.message && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink/80">{r.message}</p>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost !px-3 !py-2 text-[#9c3353]"
                    aria-label={t('deleteFrom', { name: r.name })}
                    onClick={() => confirmAction(t('confirmDelete', { name: r.name })) && remove.mutate(r.id)}
                  >
                    <Trash2 size={16} aria-hidden />
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
