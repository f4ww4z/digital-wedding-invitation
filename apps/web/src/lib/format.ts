import type { Locale, WeddingEvent } from '@sakinah/shared';

const intl = (l: Locale) => (l === 'id' ? 'id-ID' : 'en-GB');

/** Format the event's calendar date (in the event's own timezone, not the viewer's). */
export function eventDateParts(e: WeddingEvent, l: Locale) {
  const [y, m, d] = e.date.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl(l), { timeZone: 'UTC', ...o }).format(date);
  return { weekday: f({ weekday: 'long' }), day: f({ day: 'numeric' }), month: f({ month: 'long' }), year: f({ year: 'numeric' }) };
}

export function shortDate(e: WeddingEvent): string {
  const [y, m, d] = e.date.split('-');
  return `${d} · ${m} · ${y}`;
}

export function relativeTime(iso: string, l: Locale): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intl(l), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export function formatMoney(n: number, l: Locale): string {
  return new Intl.NumberFormat(intl(l), { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
