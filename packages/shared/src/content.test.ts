import { describe, expect, it } from 'vitest';
import { contentSchema, eventStart, fillTemplate, safeUrl, weddingStart } from './content.js';
import { defaultContent } from './defaults.js';
import { rsvpInput, wishInput } from './api.js';

describe('content schema', () => {
  it('accepts the default content', () => {
    expect(() => contentSchema.parse(defaultContent)).not.toThrow();
  });

  it('rejects dangerous URLs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com/x', '/\\evil.com']) {
      expect(safeUrl.safeParse(bad).success).toBe(false);
    }
    for (const ok of ['', '/media/a.webp', 'https://maps.google.com/?q=x']) {
      expect(safeUrl.safeParse(ok).success).toBe(true);
    }
  });

  it('computes event start in UTC from local offset', () => {
    const d = eventStart({ date: '2027-05-22', startTime: '08:00', utcOffsetMinutes: 420 });
    expect(d.toISOString()).toBe('2027-05-22T01:00:00.000Z');
    expect(weddingStart(defaultContent).toISOString()).toBe('2027-05-22T01:00:00.000Z');
  });

  it('fills templates and keeps unknown placeholders', () => {
    expect(fillTemplate('Hi {name}, {link} {x}', { name: 'A', link: 'L' })).toBe('Hi A, L {x}');
  });
});

describe('public inputs', () => {
  const token = 'abcdefghijklmnop';
  it('strips control characters and trims', () => {
    const r = rsvpInput.parse({ name: '  Bob\u0000 ', attendance: 'yes', pax: 2, clientToken: token });
    expect(r.name).toBe('Bob');
  });
  it('rejects a filled honeypot', () => {
    expect(
      wishInput.safeParse({ name: 'Bot', message: 'spam', website: 'http://x' }).success,
    ).toBe(false);
  });
  it('rejects empty names after cleaning', () => {
    expect(wishInput.safeParse({ name: '   ', message: 'hi' }).success).toBe(false);
  });
});
