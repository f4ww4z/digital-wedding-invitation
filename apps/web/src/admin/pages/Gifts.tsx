import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, Download, ExternalLink, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import type { AdminGift, AdminWishlistItem } from '@wedding/shared';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { fmtDate, useAdminMutation, useAdminQuery } from '../hooks';
import { Badge, Card, confirmAction, Dialog, Empty, PageHeader } from '../components/ui';
import { MediaField } from '../components/fields';

const METHOD: Record<AdminGift['method'], string> = { transfer: 'Bank transfer', ewallet: 'E-wallet', physical: 'Physical gift', other: 'Other' };

interface ItemDraft {
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  qty: number;
  sort: number;
}

function ItemForm({ initial, onSubmit, busy }: { initial: ItemDraft; onSubmit: (d: ItemDraft) => void; busy: boolean }) {
  const [d, setD] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(d);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-sm">
        Item
        <input className="field mt-1" required maxLength={120} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} autoFocus />
      </label>
      <label className="text-sm">
        Details (size, color, model)
        <textarea className="field mt-1" rows={2} maxLength={500} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </label>
      <label className="text-sm">
        Shop link
        <input className="field mt-1" type="url" maxLength={2048} placeholder="https://" value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          How many
          <input className="field mt-1" type="number" min={1} max={100} value={d.qty} onChange={(e) => setD({ ...d, qty: Number(e.target.value) || 1 })} />
        </label>
        <label className="text-sm">
          Order
          <input className="field mt-1" type="number" min={0} max={10000} value={d.sort} onChange={(e) => setD({ ...d, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <MediaField label="Photo" kind="image" value={d.imageUrl} onChange={(v) => setD({ ...d, imageUrl: v })} />
      <button className="btn btn-primary mt-2" disabled={busy || !d.name.trim()}>
        Save item
      </button>
    </form>
  );
}

export default function Gifts() {
  const gifts = useAdminQuery<AdminGift[]>('gifts', '/api/admin/gifts');
  const items = useAdminQuery<AdminWishlistItem[]>('wishlist', '/api/admin/wishlist');
  const [editing, setEditing] = useState<AdminWishlistItem | 'new' | null>(null);

  const mark = useAdminMutation(({ id, status }: { id: number; status: AdminGift['status'] }) => api(`/api/admin/gifts/${id}`, { method: 'PATCH', json: { status } }), {
    invalidate: ['gifts'],
  });
  const removeGift = useAdminMutation((id: number) => api(`/api/admin/gifts/${id}`, { method: 'DELETE' }), { invalidate: ['gifts'], success: 'Deleted' });
  const saveItem = useAdminMutation(
    ({ id, d }: { id?: number; d: ItemDraft }) => api(id ? `/api/admin/wishlist/${id}` : '/api/admin/wishlist', { method: id ? 'PUT' : 'POST', json: d }),
    { invalidate: ['wishlist'], success: 'Registry item saved' },
  );
  const removeItem = useAdminMutation((id: number) => api(`/api/admin/wishlist/${id}`, { method: 'DELETE' }), { invalidate: ['wishlist'], success: 'Item deleted' });
  const release = useAdminMutation((id: number) => api(`/api/admin/wishlist/claims/${id}`, { method: 'DELETE' }), { invalidate: ['wishlist'], success: 'Pick released' });

  const total = (gifts.data ?? []).reduce((a, g) => a + (g.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Gifts"
        description="Gift confirmations sent by guests, and your gift registry. Bank accounts and the shipping address are edited in Content → Gifts."
        actions={
          <a className="btn btn-ghost" href="/api/admin/gifts/export.csv">
            <Download size={18} aria-hidden /> Export
          </a>
        }
      />

      <section aria-labelledby="conf-h">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="conf-h" className="text-lg font-medium">
            Confirmations
          </h2>
          {total > 0 && <p className="text-sm text-muted">Reported total {formatMoney(total, 'id')}</p>}
        </div>
        {!gifts.data?.length ? (
          <Empty>No gift confirmations yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {gifts.data.map((g) => (
              <li key={g.id}>
                <Card className="!p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => mark.mutate({ id: g.id, status: g.status === 'received' ? 'pending' : 'received' })}
                      className={`mt-0.5 ${g.status === 'received' ? 'text-[#3d8a5a]' : 'text-muted'}`}
                      aria-label={g.status === 'received' ? `Mark gift from ${g.name} as not received` : `Mark gift from ${g.name} as received`}
                      aria-pressed={g.status === 'received'}
                    >
                      {g.status === 'received' ? <CheckCircle2 size={22} aria-hidden /> : <Circle size={22} aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <Badge>{METHOD[g.method]}</Badge>
                        {g.amount ? <span className="tabular-nums">{formatMoney(g.amount, 'id')}</span> : null}
                        {g.target && <span className="text-muted">→ {g.target}</span>}
                        <span className="text-xs text-muted">{fmtDate(g.createdAt)}</span>
                      </div>
                      {g.note && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink/80">{g.note}</p>}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost !px-3 !py-2 text-[#9c3353]"
                      aria-label={`Delete confirmation from ${g.name}`}
                      onClick={() => confirmAction('Delete this confirmation?') && removeGift.mutate(g.id)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reg-h" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="reg-h" className="text-lg font-medium">
            Gift registry
          </h2>
          <button type="button" className="btn btn-primary !py-2 text-sm" onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden /> Add item
          </button>
        </div>
        {!items.data?.length ? (
          <Empty>No registry items. Add things you'd love to receive; guests pick one so nobody doubles up.</Empty>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {items.data.map((it) => (
              <li key={it.id}>
                <Card className="h-full !p-4">
                  <div className="flex gap-3">
                    {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl bg-primary-soft" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{it.name}</p>
                      <p className="text-xs text-muted">
                        {it.claims.length}/{it.qty} picked
                        {it.link && (
                          <a href={it.link} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary-strong">
                            link <ExternalLink size={11} aria-hidden />
                          </a>
                        )}
                      </p>
                    </div>
                    <button type="button" className="btn btn-ghost !px-2.5 !py-2" aria-label={`Edit ${it.name}`} onClick={() => setEditing(it)}>
                      <Pencil size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost !px-2.5 !py-2 text-[#9c3353]"
                      aria-label={`Delete ${it.name}`}
                      onClick={() => confirmAction(`Delete ${it.name} and its picks?`) && removeItem.mutate(it.id)}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                  {it.claims.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                      {it.claims.map((c) => (
                        <li key={c.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          <span className="text-xs text-muted">{fmtDate(c.createdAt)}</span>
                          <button
                            type="button"
                            className="rounded-full p-1 text-muted hover:bg-line"
                            aria-label={`Release pick by ${c.name}`}
                            title="Release this pick"
                            onClick={() => confirmAction(`Release ${c.name}'s pick?`) && release.mutate(c.id)}
                          >
                            <Undo2 size={14} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add registry item' : 'Edit registry item'}>
        {editing !== null && (
          <ItemForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? { name: '', description: '', imageUrl: '', link: '', qty: 1, sort: (items.data?.length ?? 0) + 1 } : { ...editing }}
            busy={saveItem.isPending}
            onSubmit={(d) => saveItem.mutate({ id: editing === 'new' ? undefined : editing.id, d }, { onSuccess: () => setEditing(null) })}
          />
        )}
      </Dialog>
    </>
  );
}
