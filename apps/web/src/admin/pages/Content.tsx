import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { contentSchema, etiquetteIcons, type InvitationContent, type LText, type Person, type WeddingEvent } from '@wedding/shared';
import { api, ApiRequestError, errorMessage } from '../../lib/api';
import { useAdminQuery } from '../hooks';
import { Card, PageHeader } from '../components/ui';
import { ColorField, LField, ListEditor, MediaField, NumberField, SelectField, TextField, Toggle, useUpload } from '../components/fields';

type C = InvitationContent;
type Update = (fn: (d: C) => void) => void;

const TABS = [
  { id: 'general', label: 'General & look' },
  { id: 'couple', label: 'Couple' },
  { id: 'opening', label: 'Opening' },
  { id: 'events', label: 'Events' },
  { id: 'story', label: 'Story' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'gift', label: 'Gifts' },
  { id: 'rsvp', label: 'RSVP & wishes' },
  { id: 'more', label: 'Closing & more' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const emptyL = (): LText => ({ id: '', en: '' });

/* ISO (UTC) <-> <input type="datetime-local"> in the admin's own timezone */
const isoToLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localToIso = (v: string) => (v ? new Date(v).toISOString() : '');

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function PersonEditor({ p, set, label }: { p: Person; set: (p: Person) => void; label: string }) {
  return (
    <Section title={label}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Nickname" hint="Shown large on the cover" value={p.nickname} max={40} onChange={(v) => set({ ...p, nickname: v })} />
        <TextField label="Full name with titles" value={p.fullName} max={120} onChange={(v) => set({ ...p, fullName: v })} />
      </div>
      <MediaField label="Photo" hint="Portrait works best (3:4)" editor={{ aspect: 3 / 4, shape: 'arch' }} value={p.photo} onChange={(v) => set({ ...p, photo: v })} />
      <LField label="Child order" hint='e.g. "Putri kedua dari" / "Second daughter of"' value={p.childOrder} onChange={(v) => set({ ...p, childOrder: v })} max={120} />
      <LField label="Parents" value={p.parents} onChange={(v) => set({ ...p, parents: v })} max={240} />
      <TextField label="Instagram handle" hint="Without @. Leave empty to hide." value={p.instagram} max={60} onChange={(v) => set({ ...p, instagram: v.replace(/^@/, '') })} />
    </Section>
  );
}

function EventEditor({ e, set }: { e: WeddingEvent; set: (e: WeddingEvent) => void }) {
  return (
    <>
      <LField label="Event name" value={e.name} onChange={(v) => set({ ...e, name: v })} max={80} />
      <div className="grid grid-cols-2 items-end gap-4 md:grid-cols-4">
        <TextField label="Date" type="date" value={e.date} onChange={(v) => set({ ...e, date: v })} />
        <TextField label="Starts" type="time" value={e.startTime} onChange={(v) => set({ ...e, startTime: v })} />
        <TextField label="Ends" hint="Empty = until done" type="time" value={e.endTime} onChange={(v) => set({ ...e, endTime: v })} />
        <SelectField
          label="Time zone"
          value={String(e.utcOffsetMinutes)}
          onChange={(v) => set({ ...e, utcOffsetMinutes: Number(v), timezoneLabel: { '420': 'WIB', '480': 'WITA', '540': 'WIT' }[v] ?? e.timezoneLabel })}
          options={[
            { value: '420', label: 'WIB (UTC+7)' },
            { value: '480', label: 'WITA (UTC+8)' },
            { value: '540', label: 'WIT (UTC+9)' },
            ...(['420', '480', '540'].includes(String(e.utcOffsetMinutes)) ? [] : [{ value: String(e.utcOffsetMinutes), label: `${e.timezoneLabel} (custom)` }]),
          ]}
        />
      </div>
      <TextField label="Venue" value={e.venue} max={160} onChange={(v) => set({ ...e, venue: v })} />
      <TextField label="Address" multiline rows={2} value={e.address} max={400} onChange={(v) => set({ ...e, address: v })} />
      <TextField label="Google Maps link" hint="Share → Copy link in Google Maps" value={e.mapsUrl} onChange={(v) => set({ ...e, mapsUrl: v })} />
      <TextField label="Embedded map search" hint="Place name or address used for the in-page map. Empty hides it." value={e.mapsEmbedQuery} max={300} onChange={(v) => set({ ...e, mapsEmbedQuery: v })} />
    </>
  );
}

function GalleryBulkUpload({ onAdd }: { onAdd: (url: string) => void }) {
  const up = useUpload((m) => m.kind === 'image' && onAdd(m.url));
  return (
    <label className={`btn btn-ghost self-start !py-2 text-sm ${up.busy ? 'pointer-events-none opacity-60' : ''}`}>
      <Upload size={16} aria-hidden /> {up.busy ? 'Uploading…' : 'Upload several photos'}
      <input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => {
          void up.run(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function Editor({ d, u, tab }: { d: C; u: Update; tab: Tab }) {
  switch (tab) {
    case 'general':
      return (
        <>
          <Section title="Page" description="What people see in browser tabs and link previews (WhatsApp, etc.).">
            <TextField label="Title" value={d.meta.title} max={120} onChange={(v) => u((x) => void (x.meta.title = v))} />
            <TextField label="Description" multiline rows={2} value={d.meta.description} max={300} onChange={(v) => u((x) => void (x.meta.description = v))} />
            <MediaField label="Preview image" hint="1200×630 works best" editor={{ aspect: 1200 / 630, aspectLabel: 'Link preview' }} value={d.meta.ogImage} onChange={(v) => u((x) => void (x.meta.ogImage = v))} />
            <Toggle
              label="Allow search engines"
              hint="Off keeps the invitation out of Google results. Link previews in WhatsApp work either way."
              checked={d.meta.allowIndexing}
              onChange={(v) => u((x) => void (x.meta.allowIndexing = v))}
            />
            <SelectField
              label="Default language"
              value={d.defaultLocale}
              onChange={(v) => u((x) => void (x.defaultLocale = v))}
              options={[
                { value: 'id', label: 'Bahasa Indonesia' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Section>
          <Section title="Colors" description="The whole invitation, including the 3D envelope and florals, is tinted from these.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <ColorField label="Primary (rose)" value={d.theme.primary} onChange={(v) => u((x) => void (x.theme.primary = v))} />
              <ColorField label="Accent (leaves)" value={d.theme.accent} onChange={(v) => u((x) => void (x.theme.accent = v))} />
              <ColorField label="Background" value={d.theme.background} onChange={(v) => u((x) => void (x.theme.background = v))} />
              <ColorField label="Cards" value={d.theme.surface} onChange={(v) => u((x) => void (x.theme.surface = v))} />
              <ColorField label="Text" value={d.theme.text} onChange={(v) => u((x) => void (x.theme.text = v))} />
              <ColorField label="Secondary text" value={d.theme.muted} onChange={(v) => u((x) => void (x.theme.muted = v))} />
            </div>
          </Section>
          <Section title="Cover">
            <LField label="Small heading" value={d.cover.eyebrow} onChange={(v) => u((x) => void (x.cover.eyebrow = v))} max={60} />
            <LField label="Before the guest's name" value={d.cover.guestPrefix} onChange={(v) => u((x) => void (x.cover.guestPrefix = v))} max={60} />
            <LField label="Name when the link has no guest" value={d.cover.defaultGuest} onChange={(v) => u((x) => void (x.cover.defaultGuest = v))} max={60} />
            <LField label="Open button" value={d.cover.openButton} onChange={(v) => u((x) => void (x.cover.openButton = v))} max={40} />
          </Section>
          <Section title="Music" description="Starts when the guest opens the invitation. MP3 is the most compatible.">
            <Toggle label="Play background music" checked={d.music.enabled} onChange={(v) => u((x) => void (x.music.enabled = v))} />
            <MediaField label="Audio file" kind="audio" value={d.music.src} onChange={(v) => u((x) => void (x.music.src = v))} />
            <TextField label="Song title (for your reference)" value={d.music.title} max={120} onChange={(v) => u((x) => void (x.music.title = v))} />
          </Section>
        </>
      );
    case 'couple':
      return (
        <>
          <Section title="Order">
            <SelectField
              label="Who is named first"
              value={d.couple.order}
              onChange={(v) => u((x) => void (x.couple.order = v))}
              options={[
                { value: 'bride-first', label: 'Bride first' },
                { value: 'groom-first', label: 'Groom first' },
              ]}
            />
          </Section>
          <PersonEditor label="Bride" p={d.couple.bride} set={(p) => u((x) => void (x.couple.bride = p))} />
          <PersonEditor label="Groom" p={d.couple.groom} set={(p) => u((x) => void (x.couple.groom = p))} />
        </>
      );
    case 'opening':
      return (
        <Section title="Opening">
          <LField label="Greeting" value={d.opening.greeting} onChange={(v) => u((x) => void (x.opening.greeting = v))} max={200} />
          <LField label="Introduction" multiline rows={4} value={d.opening.intro} onChange={(v) => u((x) => void (x.opening.intro = v))} max={600} />
          <Toggle label="Show a verse" checked={d.opening.verseEnabled} onChange={(v) => u((x) => void (x.opening.verseEnabled = v))} />
          {d.opening.verseEnabled && (
            <>
              <TextField label="Arabic text" multiline rows={3} dir="rtl" value={d.opening.verseArabic} max={1000} onChange={(v) => u((x) => void (x.opening.verseArabic = v))} />
              <LField label="Translation" multiline rows={4} value={d.opening.verseText} onChange={(v) => u((x) => void (x.opening.verseText = v))} max={1000} />
              <TextField label="Source" value={d.opening.verseSource} max={80} onChange={(v) => u((x) => void (x.opening.verseSource = v))} />
            </>
          )}
        </Section>
      );
    case 'events':
      return (
        <>
          <Section title="Countdown">
            <Toggle label="Show countdown to the first event" checked={d.countdown.enabled} onChange={(v) => u((x) => void (x.countdown.enabled = v))} />
          </Section>
          <Section title="Events" description="The first event is used for the countdown and the date on the cover.">
            <ListEditor
              items={d.events}
              onChange={(v) => u((x) => void (x.events = v))}
              max={6}
              addLabel="Add event"
              itemLabel={(e, i) => e.name.id || `Event ${i + 1}`}
              make={() => ({
                id: `event-${Math.random().toString(36).slice(2, 8)}`,
                name: emptyL(),
                date: d.events[0]?.date ?? new Date().toISOString().slice(0, 10),
                startTime: '10:00',
                endTime: '',
                timezoneLabel: 'WIB',
                utcOffsetMinutes: 420,
                venue: '',
                address: '',
                mapsUrl: '',
                mapsEmbedQuery: '',
              })}
              render={(e, set) => <EventEditor e={e} set={set} />}
            />
          </Section>
        </>
      );
    case 'story':
      return (
        <Section title="Love story">
          <Toggle label="Show this section" checked={d.story.enabled} onChange={(v) => u((x) => void (x.story.enabled = v))} />
          <ListEditor
            items={d.story.items}
            onChange={(v) => u((x) => void (x.story.items = v))}
            max={12}
            addLabel="Add moment"
            itemLabel={(s, i) => s.title.id || `Moment ${i + 1}`}
            make={() => ({ title: emptyL(), date: emptyL(), text: emptyL(), image: '' })}
            render={(s, set) => (
              <>
                <LField label="Title" value={s.title} onChange={(v) => set({ ...s, title: v })} max={80} />
                <LField label="When" value={s.date} onChange={(v) => set({ ...s, date: v })} max={60} />
                <LField label="Story" multiline rows={4} value={s.text} onChange={(v) => set({ ...s, text: v })} max={1500} />
                <MediaField label="Photo (optional)" editor={{ aspect: 4 / 3 }} value={s.image} onChange={(v) => set({ ...s, image: v })} />
              </>
            )}
          />
        </Section>
      );
    case 'gallery':
      return (
        <Section title="Gallery">
          <Toggle label="Show this section" checked={d.gallery.enabled} onChange={(v) => u((x) => void (x.gallery.enabled = v))} />
          <GalleryBulkUpload onAdd={(url) => u((x) => void x.gallery.images.push({ src: url, alt: '' }))} />
          <ListEditor
            items={d.gallery.images}
            onChange={(v) => u((x) => void (x.gallery.images = v))}
            max={40}
            addLabel="Add photo"
            itemLabel={(_, i) => `Photo ${i + 1}`}
            make={() => ({ src: '', alt: '' })}
            render={(g, set) => (
              <>
                <MediaField label="Image" value={g.src} onChange={(v) => set({ ...g, src: v })} />
                <TextField label="Description (for screen readers)" value={g.alt} max={160} onChange={(v) => set({ ...g, alt: v })} />
              </>
            )}
          />
        </Section>
      );
    case 'gift':
      return (
        <>
          <Section title="Gifts">
            <Toggle label="Show the gift section" checked={d.gift.enabled} onChange={(v) => u((x) => void (x.gift.enabled = v))} />
            <LField label="Introduction" multiline rows={3} value={d.gift.intro} onChange={(v) => u((x) => void (x.gift.intro = v))} max={600} />
            <Toggle label="Let guests confirm they sent a gift" checked={d.gift.confirmationEnabled} onChange={(v) => u((x) => void (x.gift.confirmationEnabled = v))} />
            <Toggle label="Show the gift registry" hint="Manage items in Gifts" checked={d.gift.wishlistEnabled} onChange={(v) => u((x) => void (x.gift.wishlistEnabled = v))} />
          </Section>
          <Section title="Bank & e-wallet accounts">
            <ListEditor
              items={d.gift.accounts}
              onChange={(v) => u((x) => void (x.gift.accounts = v))}
              max={8}
              addLabel="Add account"
              itemLabel={(a, i) => a.provider || `Account ${i + 1}`}
              make={() => ({ type: 'bank' as const, provider: '', number: '', holder: '', qrImage: '' })}
              render={(a, set) => (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField
                      label="Type"
                      value={a.type}
                      onChange={(v) => set({ ...a, type: v })}
                      options={[
                        { value: 'bank', label: 'Bank' },
                        { value: 'ewallet', label: 'E-wallet' },
                      ]}
                    />
                    <TextField label="Bank / app" placeholder="BCA, GoPay…" value={a.provider} max={60} onChange={(v) => set({ ...a, provider: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Account number" value={a.number} max={60} onChange={(v) => set({ ...a, number: v })} />
                    <TextField label="Account holder" value={a.holder} max={120} onChange={(v) => set({ ...a, holder: v })} />
                  </div>
                  <MediaField label="QR code / QRIS (optional)" editor={{ aspect: 1 }} value={a.qrImage} onChange={(v) => set({ ...a, qrImage: v })} />
                </>
              )}
            />
          </Section>
          <Section title="Shipping address for gifts">
            <Toggle label="Show the address" checked={d.gift.addressEnabled} onChange={(v) => u((x) => void (x.gift.addressEnabled = v))} />
            <TextField label="Recipient" value={d.gift.addressRecipient} max={120} onChange={(v) => u((x) => void (x.gift.addressRecipient = v))} />
            <TextField label="Address" multiline rows={2} value={d.gift.address} max={400} onChange={(v) => u((x) => void (x.gift.address = v))} />
            <TextField label="Phone" value={d.gift.addressPhone} max={40} onChange={(v) => u((x) => void (x.gift.addressPhone = v))} />
          </Section>
        </>
      );
    case 'rsvp':
      return (
        <>
          <Section title="RSVP">
            <Toggle label="Accept RSVPs" checked={d.rsvp.enabled} onChange={(v) => u((x) => void (x.rsvp.enabled = v))} />
            <TextField label="Close RSVPs at" hint="Empty = never closes" type="datetime-local" value={isoToLocal(d.rsvp.deadline)} onChange={(v) => u((x) => void (x.rsvp.deadline = localToIso(v)))} />
            <NumberField label="Default max guests per invite" hint="Used for open links and guests without their own limit" min={1} max={20} value={d.rsvp.maxPaxDefault} onChange={(v) => u((x) => void (x.rsvp.maxPaxDefault = v))} />
          </Section>
          <Section title="Wishes">
            <Toggle label="Show the wishes wall" checked={d.wishes.enabled} onChange={(v) => u((x) => void (x.wishes.enabled = v))} />
            <Toggle label="Approve wishes before they appear" checked={d.wishes.requireApproval} onChange={(v) => u((x) => void (x.wishes.requireApproval = v))} />
          </Section>
        </>
      );
    case 'more':
      return (
        <>
          <Section title="Closing">
            <LField label="Closing message" multiline rows={3} value={d.closing.text} onChange={(v) => u((x) => void (x.closing.text = v))} max={600} />
            <LField label="Signature line" value={d.closing.signature} onChange={(v) => u((x) => void (x.closing.signature = v))} max={120} />
            <MediaField label="Closing photo (optional)" editor={{ aspect: 7 / 9, aspectLabel: 'Arch 7:9', shape: 'arch' }} value={d.closing.image} onChange={(v) => u((x) => void (x.closing.image = v))} />
          </Section>
          <Section title="WhatsApp message" description="Used by the Send button on the Guests page. {name} and {link} are filled in per guest.">
            <LField label="Message" multiline rows={7} value={d.share.whatsappTemplate} onChange={(v) => u((x) => void (x.share.whatsappTemplate = v))} max={1500} />
          </Section>
          <Section title="Live stream">
            <Toggle label="Show live stream link" checked={d.livestream.enabled} onChange={(v) => u((x) => void (x.livestream.enabled = v))} />
            <TextField label="Stream URL" value={d.livestream.url} onChange={(v) => u((x) => void (x.livestream.url = v))} />
            <TextField label="Platform name" value={d.livestream.platform} max={40} onChange={(v) => u((x) => void (x.livestream.platform = v))} />
            <LField label="Text" value={d.livestream.text} onChange={(v) => u((x) => void (x.livestream.text = v))} max={300} />
          </Section>
          <Section title="Guest etiquette">
            <Toggle label="Show this section" checked={d.etiquette.enabled} onChange={(v) => u((x) => void (x.etiquette.enabled = v))} />
            <ListEditor
              items={d.etiquette.items}
              onChange={(v) => u((x) => void (x.etiquette.items = v))}
              max={12}
              addLabel="Add item"
              itemLabel={(e, i) => e.text.id || `Item ${i + 1}`}
              make={() => ({ icon: 'clock' as const, text: emptyL() })}
              render={(e, set) => (
                <>
                  <SelectField label="Icon" value={e.icon} onChange={(v) => set({ ...e, icon: v })} options={etiquetteIcons.map((i) => ({ value: i, label: i }))} />
                  <LField label="Text" value={e.text} onChange={(v) => set({ ...e, text: v })} max={160} />
                </>
              )}
            />
          </Section>
        </>
      );
  }
}

export default function ContentEditor() {
  const q = useAdminQuery<{ content: C; updatedAt: string; repaired?: string[] }>('content', '/api/admin/content');
  const qc = useQueryClient();
  const [draft, setDraft] = useState<C | null>(null);
  const [base, setBase] = useState<{ content: C; updatedAt: string } | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data && !base) {
      setBase(q.data);
      setDraft(structuredClone(q.data.content));
    }
  }, [q.data, base]);

  const dirty = useMemo(() => !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base.content), [draft, base]);
  const issues = useMemo(() => {
    if (!draft) return [];
    const r = contentSchema.safeParse(draft);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join(' › ')}: ${i.message}`);
  }, [draft]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!draft || !base) return <p className="text-sm text-muted">Loading…</p>;

  const u: Update = (fn) =>
    setDraft((prev) => {
      const next = structuredClone(prev!);
      fn(next);
      return next;
    });

  const save = async () => {
    if (issues.length) {
      toast.error(`Fix ${issues.length} problem${issues.length > 1 ? 's' : ''} before saving`);
      return;
    }
    setSaving(true);
    try {
      const r = await api<{ content: C; updatedAt: string }>('/api/admin/content', { method: 'PUT', json: { content: draft, updatedAt: base.updatedAt } });
      setBase(r);
      qc.setQueryData(['admin', 'content'], r);
      void qc.invalidateQueries({ queryKey: ['content'] });
      toast.success('Changes published');
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        toast.error('Someone saved changes in another tab. Reload to get them; your unsaved edits here will be lost.', { duration: 10000 });
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!window.confirm('Discard all unsaved changes?')) return;
    setDraft(structuredClone(base.content));
  };

  return (
    <>
      <PageHeader
        title="Content"
        description="Everything guests see. Changes go live when you publish."
        actions={
          <a className="btn btn-ghost" href="/" target="_blank" rel="noopener">
            <ExternalLink size={18} aria-hidden /> Preview
          </a>
        }
      />
      {!!q.data?.repaired?.length && (
        <div role="status" className="mb-4 rounded-2xl border border-[#c08a1e]/40 bg-[#c08a1e]/10 p-4 text-sm text-[#7a560f]">
          Some saved values were no longer valid and were reset: <strong>{q.data.repaired.join(', ')}</strong>. Check them, then publish to save.
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-8">
        <nav aria-label="Content sections" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm ${tab === t.id ? 'bg-primary-soft font-medium' : 'text-muted hover:bg-line/60'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <Editor d={draft} u={u} tab={tab} />
        </div>
      </div>

      {(dirty || issues.length > 0) && (
        <div className="fixed inset-x-3 bottom-[4.6rem] z-30 mx-auto max-w-2xl rounded-2xl border border-line bg-surface/95 p-3 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.35)] backdrop-blur lg:bottom-6 lg:left-[17rem]">
          {issues.length > 0 && (
            <details className="mb-2 text-xs text-[#9c3353]">
              <summary className="cursor-pointer">{issues.length} field{issues.length > 1 ? 's need' : ' needs'} fixing</summary>
              <ul className="mt-1 max-h-24 list-disc overflow-auto pl-5">
                {issues.slice(0, 10).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex items-center gap-2">
            <p className="mr-auto text-sm">{dirty ? 'Unsaved changes' : 'No changes'}</p>
            <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={discard} disabled={!dirty || saving}>
              <RotateCcw size={16} aria-hidden /> Discard
            </button>
            <button type="button" className="btn btn-primary !py-2 text-sm" onClick={() => void save()} disabled={!dirty || saving || issues.length > 0}>
              <Save size={16} aria-hidden /> {saving ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
