/**
 * Pure helpers with no runtime dependencies (no zod), safe to import from the
 * guest-facing bundle via `@wedding/shared/util`.
 */
import type { InvitationContent, WeddingEvent } from './content.js';

export const etiquetteIcons = [
  'mask',
  'clock',
  'dress',
  'phone',
  'camera',
  'gift',
  'hands',
  'utensils',
  'pray',
  'users',
] as const;

/** Earliest event start as an absolute Date, used for countdown. */
export function weddingStart(content: Pick<InvitationContent, 'events'>): Date {
  const starts = content.events.map((e) => eventStart(e).getTime());
  return new Date(Math.min(...starts));
}

export function eventStart(e: Pick<WeddingEvent, 'date' | 'startTime' | 'utcOffsetMinutes'>): Date {
  return toUtc(e.date, e.startTime, e.utcOffsetMinutes);
}

export function eventEnd(
  e: Pick<WeddingEvent, 'date' | 'startTime' | 'endTime' | 'utcOffsetMinutes'>,
): Date {
  const start = eventStart(e);
  if (!e.endTime) return new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const end = toUtc(e.date, e.endTime, e.utcOffsetMinutes);
  // An end time earlier than the start means the event runs past midnight.
  return end > start ? end : new Date(end.getTime() + 24 * 60 * 60 * 1000);
}

function toUtc(date: string, time: string, offsetMinutes: number): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - offsetMinutes * 60 * 1000);
}

/** Fill `{name}`/`{link}` placeholders in a share template. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
