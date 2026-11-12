import type { WeddingEvent } from '@wedding/shared';
import { eventEnd, eventStart } from '@wedding/shared/util';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 text escaping. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

export function googleCalendarUrl(e: WeddingEvent, title: string, details: string): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${stamp(eventStart(e))}/${stamp(eventEnd(e))}`,
    details,
    location: `${e.venue}, ${e.address}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(events: { e: WeddingEvent; title: string }[], details: string, filename = 'wedding.ics') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Digital Wedding Invitation//EN', 'CALSCALE:GREGORIAN'];
  for (const { e, title } of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${stamp(eventStart(e))}@invitation`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(eventStart(e))}`,
      `DTEND:${stamp(eventEnd(e))}`,
      `SUMMARY:${esc(title)}`,
      `LOCATION:${esc(`${e.venue}, ${e.address}`)}`,
      `DESCRIPTION:${esc(details)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT3H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
