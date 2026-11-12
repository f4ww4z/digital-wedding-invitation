import { useQuery } from '@tanstack/react-query';
import type { InvitationContent, PublicGuest } from '@wedding/shared';
import { api } from './api';

export function useContent() {
  return useQuery({
    queryKey: ['content'],
    queryFn: () => api<{ content: InvitationContent; updatedAt: string }>('/api/content'),
    staleTime: 60_000,
    select: (d) => d.content,
  });
}

export function useGuest(code: string | null) {
  return useQuery({
    queryKey: ['guest', code],
    queryFn: () => api<PublicGuest>(`/api/guest/${encodeURIComponent(code!)}`),
    enabled: !!code,
    retry: false,
    staleTime: Infinity,
  });
}

/** Read guest identity from the URL: `?g=CODE` (tracked) or `?to=Name` (display only). */
export function readGuestParams(): { code: string | null; toName: string | null } {
  const p = new URLSearchParams(window.location.search);
  const g = p.get('g');
  const code = g && /^[A-Za-z0-9_-]{6,32}$/.test(g) ? g : null;
  const to = p.get('to');
  // eslint-disable-next-line no-control-regex -- stripping control chars from a URL param
  const toName = to ? to.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 80) || null : null;
  return { code, toName };
}

export function applyTheme(c: InvitationContent['theme']) {
  const r = document.documentElement.style;
  r.setProperty('--c-bg', c.background);
  r.setProperty('--c-surface', c.surface);
  r.setProperty('--c-primary', c.primary);
  r.setProperty('--c-accent', c.accent);
  r.setProperty('--c-text', c.text);
  r.setProperty('--c-muted', c.muted);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.background);
}
