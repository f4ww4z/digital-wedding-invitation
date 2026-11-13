import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { AdminStats } from '@wedding/shared';
import { formatMoney } from '../../lib/format';
import { useAdminQuery } from '../hooks';
import { Card, PageHeader } from '../components/ui';
import { adminIntlLocale, adminLocale } from '../i18n';

/* Validated categorical data palette (see dataviz validator): attending, maybe, not attending. */
const RSVP_COLORS = { yes: '#3d8a5a', maybe: '#c08a1e', no: '#c2456a' } as const;

function Stat({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="display mt-1 text-[2.4rem] leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-primary/50">
      {body}
    </Link>
  ) : (
    <Card>{body}</Card>
  );
}

function RsvpBar({ r }: { r: AdminStats['rsvp'] }) {
  const { t } = useTranslation('overview');
  const total = r.yes + r.maybe + r.no;
  const parts = (['yes', 'maybe', 'no'] as const).map((k) => ({ k, n: r[k], label: t(`rsvp.${k}`) }));
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">{t('rsvpResponses')}</h2>
        <p className="text-sm text-muted">{t('total', { n: total })}</p>
      </div>
      {total === 0 ? (
        <p className="mt-6 text-sm text-muted">{t('noResponses')}</p>
      ) : (
        <>
          {/* segmented bar: 2px surface gaps between segments, rounded ends */}
          <div className="mt-5 flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.n}`).join(', ')}>
            {parts.filter((p) => p.n > 0).map((p) => (
              <div key={p.k} title={`${p.label}: ${p.n}`} style={{ flexGrow: p.n, background: RSVP_COLORS[p.k] }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:gap-4">
            {parts.map((p) => (
              <li key={p.k} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RSVP_COLORS[p.k] }} />
                <span className="text-muted">{p.label}</span>
                <span className="ml-auto font-medium tabular-nums">{p.n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Single-series daily bars, last 30 days. Hover/focus shows the exact value. */
function OpensChart({ data }: { data: AdminStats['opensByDay'] }) {
  const { t } = useTranslation('overview');
  const [hover, setHover] = useState<number | null>(null);
  const days: { day: string; count: number }[] = [];
  const map = new Map(data.map((d) => [d.day, d.count]));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day: d, count: map.get(d) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const W = 360;
  const H = 120;
  const bw = W / days.length; // 12 units per day
  const total = days.reduce((a, d) => a + d.count, 0);
  const h = hover !== null ? days[hover] : null;
  const fmt = (d: string) => new Intl.DateTimeFormat(adminIntlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d));
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">{t('opensTitle')}</h2>
        <p className="text-sm text-muted tabular-nums">{h ? `${fmt(h.day)}: ${h.count}` : t('total', { n: total })}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="mt-4 w-full" role="img" aria-label={t('opensAria', { total })} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--c-line)" strokeDasharray="2 4" />
        ))}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--c-line)" />
        <text x={W} y={10} textAnchor="end" fontSize={10} fill="var(--c-muted)">{max}</text>
        {days.map((d, i) => {
          const bh = (d.count / max) * (H - 4);
          const x = i * bw + 1.5;
          const w = bw - 3;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${fmt(d.day)}: ${d.count}`}>
              {/* hit target taller than the mark */}
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.count > 0 && <path d={`M${x} ${H} V${H - bh + 3} q0 -3 3 -3 h${w - 6} q3 0 3 3 V${H} Z`} fill="var(--c-primary)" opacity={hover === null || hover === i ? 1 : 0.45} />}
            </g>
          );
        })}
        <text x={0} y={H + 16} fontSize={10} fill="var(--c-muted)">{fmt(days[0]!.day)}</text>
        <text x={W} y={H + 16} fontSize={10} fill="var(--c-muted)" textAnchor="end">{t('today')}</text>
      </svg>
    </Card>
  );
}

export function Overview() {
  const { t } = useTranslation('overview');
  const q = useAdminQuery<AdminStats>('stats', '/api/admin/stats');
  const s = q.data;
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {!s ? (
        <p className="text-sm text-muted">{t('loading')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={t('guestsOpened')} value={`${s.guests.opened}/${s.guests.total}`} sub={t('fromPersonalLinks')} to="/admin/guests" />
            <Stat label={t('expectedAttendees')} value={s.rsvp.paxYes} sub={t('rsvpsAttending', { n: s.rsvp.yes })} to="/admin/rsvps" />
            <Stat label={t('wishes')} value={s.wishes.total} sub={s.wishes.pending ? t('waitingApproval', { n: s.wishes.pending }) : t('noneWaiting')} to="/admin/wishes" />
            <Stat
              label={t('giftsConfirmed')}
              value={s.gifts.total}
              sub={`${t('received', { n: s.gifts.received })}${s.gifts.amountTotal ? ` · ${formatMoney(s.gifts.amountTotal, adminLocale())}` : ''}`}
              to="/admin/gifts"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RsvpBar r={s.rsvp} />
            <Card>
              <h2 className="font-medium">{t('registry')}</h2>
              <p className="display mt-3 text-[2.4rem] leading-none tabular-nums">
                {s.wishlist.claimed}
                <span className="text-xl text-muted">/{s.wishlist.totalQty}</span>
              </p>
              <p className="mt-2 text-xs text-muted">{t('registryPicked', { n: s.wishlist.items })}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-[var(--c-accent)]" style={{ width: `${s.wishlist.totalQty ? (s.wishlist.claimed / s.wishlist.totalQty) * 100 : 0}%` }} />
              </div>
            </Card>
          </div>
          <OpensChart data={s.opensByDay} />
        </div>
      )}
    </>
  );
}
