import { useMemo, useState } from 'react';
import { Check, Download, EyeOff, Trash2 } from 'lucide-react';
import type { AdminWish } from '@sakinah/shared';
import { api } from '../../lib/api';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { Badge, Card, confirmAction, Empty, PageHeader } from '../components/ui';

type Status = AdminWish['status'];

export default function Wishes() {
  const q = useAdminQuery<AdminWish[]>('wishes', '/api/admin/wishes');
  const [filter, setFilter] = useState<Status | ''>('');
  const setStatus = useAdminMutation(({ id, status }: { id: number; status: Status }) => api(`/api/admin/wishes/${id}`, { method: 'PATCH', json: { status } }), {
    invalidate: ['wishes'],
    success: 'Wish updated',
  });
  const remove = useAdminMutation((id: number) => api(`/api/admin/wishes/${id}`, { method: 'DELETE' }), { invalidate: ['wishes'], success: 'Wish deleted' });
  const list = useMemo(() => (q.data ?? []).filter((w) => !filter || w.status === filter), [q.data, filter]);
  const pending = (q.data ?? []).filter((w) => w.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Wishes"
        description="Hide anything you don't want shown on the invitation. Turn on approval in Content → RSVP & wishes to review new wishes first."
        actions={
          <a className="btn btn-ghost" href="/api/admin/wishes/export.csv">
            <Download size={18} aria-hidden /> Export
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by status">
        {(['', 'pending', 'visible', 'hidden'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${filter === f ? 'border-primary bg-primary-soft' : 'border-line text-muted'}`}
          >
            {f || 'All'}
            {f === 'pending' && pending ? ` (${pending})` : ''}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !list.length ? (
        <Empty>No wishes {filter ? `marked ${filter}` : 'yet'}.</Empty>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((w) => (
            <li key={w.id}>
              <Card className={`h-full !p-4 ${w.status === 'hidden' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium">{w.name}</p>
                  {w.status === 'pending' && <Badge tone="warn">Waiting</Badge>}
                  {w.status === 'hidden' && <Badge>Hidden</Badge>}
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm text-ink/85">{w.message}</p>
                <div className="mt-3 flex items-center gap-1">
                  <span className="mr-auto text-xs text-muted">{fmtDate(w.createdAt)}</span>
                  {w.status !== 'visible' && (
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setStatus.mutate({ id: w.id, status: 'visible' })}>
                      <Check size={14} aria-hidden /> Show
                    </button>
                  )}
                  {w.status !== 'hidden' && (
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setStatus.mutate({ id: w.id, status: 'hidden' })}>
                      <EyeOff size={14} aria-hidden /> Hide
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost !px-3 !py-1.5 text-xs text-[#9c3353]"
                    aria-label={`Delete wish from ${w.name}`}
                    onClick={() => confirmAction('Delete this wish permanently?') && remove.mutate(w.id)}
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
