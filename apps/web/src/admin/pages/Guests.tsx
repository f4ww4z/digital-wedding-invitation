import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Copy, Download, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { fillTemplate, type AdminGuest, type GuestInput, type InvitationContent } from '@sakinah/shared';
import { api } from '../../lib/api';
import { parseCsv, rowsToGuests, waNumber, type ImportedGuest } from '../csv';
import { fmtDate, inviteLink, useAdminMutation, useAdminQuery } from '../hooks';
import { Badge, Card, confirmAction, Dialog, Empty, PageHeader } from '../components/ui';

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

function GuestForm({ initial, onSubmit, busy }: { initial?: Partial<GuestInput>; onSubmit: (g: GuestInput) => void; busy: boolean }) {
  const [g, setG] = useState<GuestInput>({ name: '', group: '', phone: '', notes: '', ...initial });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(g);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-sm">
        Name as it appears on the invitation
        <input className="field mt-1" required maxLength={120} value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Bapak Budi & Keluarga" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Group
          <input className="field mt-1" maxLength={60} value={g.group} onChange={(e) => setG({ ...g, group: e.target.value })} placeholder="Family, Office…" />
        </label>
        <label className="text-sm">
          Max guests
          <input className="field mt-1" type="number" min={1} max={20} value={g.maxPax ?? ''} onChange={(e) => setG({ ...g, maxPax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Default" />
        </label>
      </div>
      <label className="text-sm">
        WhatsApp number
        <input className="field mt-1" inputMode="tel" maxLength={30} value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} placeholder="0812…" />
      </label>
      <label className="text-sm">
        Private notes
        <textarea className="field mt-1" rows={2} maxLength={500} value={g.notes} onChange={(e) => setG({ ...g, notes: e.target.value })} />
      </label>
      <button className="btn btn-primary mt-2" disabled={busy || !g.name.trim()}>
        Save guest
      </button>
    </form>
  );
}

export default function Guests({ publicUrl }: { publicUrl: string }) {
  const guests = useAdminQuery<AdminGuest[]>('guests', '/api/admin/guests');
  const content = useAdminQuery<{ content: InvitationContent }>('content', '/api/admin/content');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState<'' | 'opened' | 'unopened' | 'responded' | 'pending'>('');
  const [editing, setEditing] = useState<AdminGuest | 'new' | null>(null);
  const [importRows, setImportRows] = useState<ImportedGuest[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = useAdminMutation((g: GuestInput) => api('/api/admin/guests', { method: 'POST', json: g }), { invalidate: ['guests'], success: 'Guest added' });
  const update = useAdminMutation(({ id, g }: { id: number; g: GuestInput }) => api(`/api/admin/guests/${id}`, { method: 'PUT', json: g }), { invalidate: ['guests'], success: 'Guest updated' });
  const remove = useAdminMutation((id: number) => api(`/api/admin/guests/${id}`, { method: 'DELETE' }), { invalidate: ['guests', 'rsvps'], success: 'Guest deleted' });
  const regen = useAdminMutation((id: number) => api(`/api/admin/guests/${id}/regenerate-code`, { method: 'POST' }), { invalidate: ['guests'], success: 'New link created. The old link no longer works.' });
  const importM = useAdminMutation((list: ImportedGuest[]) => api<{ created: number }>('/api/admin/guests/import', { method: 'POST', json: { guests: list } }), {
    invalidate: ['guests'],
    success: (r) => `Imported ${r.created} guests`,
  });

  const groups = useMemo(() => [...new Set((guests.data ?? []).map((g) => g.group).filter(Boolean))].sort(), [guests.data]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (guests.data ?? []).filter(
      (g) =>
        (!q || g.name.toLowerCase().includes(q) || g.phone.includes(q)) &&
        (!group || g.group === group) &&
        (!status ||
          (status === 'opened' && g.openCount > 0) ||
          (status === 'unopened' && g.openCount === 0) ||
          (status === 'responded' && g.rsvpAttendance) ||
          (status === 'pending' && !g.rsvpAttendance)),
    );
  }, [guests.data, query, group, status]);

  const template = content.data?.content.share.whatsappTemplate.id ?? '{name}\n{link}';
  const share = (g: AdminGuest) => {
    const text = fillTemplate(template, { name: g.name, link: inviteLink(publicUrl, g.code) });
    const url = g.phone ? `https://wa.me/${waNumber(g.phone)}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  };
  const copy = async (g: AdminGuest) => {
    await navigator.clipboard.writeText(inviteLink(publicUrl, g.code));
    toast.success(`Link for ${g.name} copied`);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const rows = rowsToGuests(parseCsv(await f.text()));
    if (!rows.length) toast.error('No guests found. The file needs a "name" column.');
    else setImportRows(rows);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <PageHeader
        title="Guests"
        description="Each guest gets a personal link. It shows their name on the cover and tracks whether they opened it and RSVP'd."
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={18} aria-hidden /> Add guest
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={18} aria-hidden /> Import CSV
            </button>
            <a className="btn btn-ghost" href="/api/admin/guests/export.csv">
              <Download size={18} aria-hidden /> Export
            </a>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Search guests</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field !pl-9" placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="field !w-auto" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group">
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="opened">Opened</option>
          <option value="unopened">Not opened yet</option>
          <option value="responded">RSVP'd</option>
          <option value="pending">No RSVP yet</option>
        </select>
      </div>

      {guests.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !guests.data?.length ? (
        <Empty>No guests yet. Add them one by one or import a CSV with a "name" column (optional: group, phone, pax, notes).</Empty>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            Showing {list.length} of {guests.data.length}
          </p>
          <ul className="flex flex-col gap-2">
            {list.map((g) => (
              <li key={g.id}>
                <Card className="!p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[g.group, g.phone, `max ${g.maxPax}`].filter(Boolean).join(' · ')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {g.openCount > 0 ? <Badge tone="yes">Opened {g.openCount}×</Badge> : <Badge>Not opened</Badge>}
                        {g.rsvpAttendance ? (
                          <Badge tone={g.rsvpAttendance}>
                            {{ yes: `Attending · ${g.rsvpPax}`, no: 'Not attending', maybe: 'Not sure' }[g.rsvpAttendance]}
                          </Badge>
                        ) : (
                          <Badge>No RSVP</Badge>
                        )}
                        {g.lastOpenedAt && <span className="text-xs text-muted">last opened {fmtDate(g.lastOpenedAt)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:shrink-0">
                      <button type="button" className="btn btn-primary !px-3 !py-2 text-sm" onClick={() => share(g)} title="Send via WhatsApp">
                        <WhatsAppIcon /> Send
                      </button>
                      <button type="button" className="btn btn-ghost !px-3 !py-2" onClick={() => void copy(g)} aria-label={`Copy link for ${g.name}`} title="Copy link">
                        <Copy size={16} aria-hidden />
                      </button>
                      <button type="button" className="btn btn-ghost !px-3 !py-2" onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`} title="Edit">
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !px-3 !py-2"
                        title="Create a new link (the old one stops working)"
                        aria-label={`New link for ${g.name}`}
                        onClick={() => confirmAction(`Create a new link for ${g.name}? The old link will stop working.`) && regen.mutate(g.id)}
                      >
                        <RefreshCw size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !px-3 !py-2 text-[#9c3353]"
                        aria-label={`Delete ${g.name}`}
                        title="Delete"
                        onClick={() => confirmAction(`Delete ${g.name}? Their RSVP is deleted too.`) && remove.mutate(g.id)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add guest' : 'Edit guest'}>
        {editing !== null && (
          <GuestForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : { name: editing.name, group: editing.group, phone: editing.phone, maxPax: editing.maxPax, notes: editing.notes }}
            busy={create.isPending || update.isPending}
            onSubmit={(g) => {
              const done = { onSuccess: () => setEditing(null) };
              if (editing === 'new') create.mutate(g, done);
              else update.mutate({ id: editing.id, g }, done);
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!importRows} onClose={() => setImportRows(null)} title="Import guests" wide>
        {importRows && (
          <>
            <p className="text-sm text-muted">Found {importRows.length} guests. Check the first rows, then import.</p>
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Group</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((g, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-1.5">{g.name}</td>
                      <td className="px-3 py-1.5">{g.group}</td>
                      <td className="px-3 py-1.5">{g.phone}</td>
                      <td className="px-3 py-1.5">{g.maxPax ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={importM.isPending}
              onClick={() => importM.mutate(importRows, { onSuccess: () => setImportRows(null) })}
            >
              Import {importRows.length} guests
            </button>
          </>
        )}
      </Dialog>
    </>
  );
}
