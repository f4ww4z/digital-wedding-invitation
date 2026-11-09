import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import type { InvitationContent, WishesPage } from '@sakinah/shared';
import { api, errorMessage } from '../../lib/api';
import { clientToken, rememberName } from '../../lib/clientToken';
import { useL } from '../../lib/i18n';
import { relativeTime } from '../../lib/format';
import { Section, SectionTitle } from '../motion';

const BADGE: Record<string, string> = {
  yes: 'bg-accent-soft text-accent',
  no: 'bg-primary-soft text-primary-strong',
  maybe: 'bg-line text-muted',
};

export function Wishes({ guestCode, guestName }: { c: InvitationContent; guestCode: string | null; guestName: string }) {
  const { t } = useTranslation();
  const { lang } = useL();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['wishes'],
    queryFn: ({ pageParam }) => api<WishesPage>(`/api/wishes?limit=8${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const [name, setName] = useState(guestName || rememberName());
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');
  const m = useMutation({
    mutationFn: () =>
      api<{ status: string }>('/api/wishes', { method: 'POST', json: { guestCode: guestCode ?? undefined, name, message, clientToken: clientToken(), website: hp } }),
    onSuccess: (r) => {
      rememberName(name);
      setMessage('');
      toast.success(r.status === 'pending' ? t('wishPending') : t('wishSent'));
      void qc.invalidateQueries({ queryKey: ['wishes'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <Section id="wishes">
      <SectionTitle sub={total ? t('wishesCount', { count: total }) : undefined}>{t('wishes')}</SectionTitle>
      <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-[2rem] p-6">
        <label className="sr-only" htmlFor="wish-name">{t('yourName')}</label>
        <input id="wish-name" className="field" required maxLength={80} placeholder={t('yourName')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label className="sr-only" htmlFor="wish-msg">{t('yourWish')}</label>
        <textarea id="wish-msg" className="field" required rows={3} maxLength={1000} placeholder={t('yourWish')} value={message} onChange={(e) => setMessage(e.target.value)} />
        <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
        <button className="btn btn-primary" disabled={m.isPending || !name.trim() || !message.trim()}>
          {t('sendWish')}
        </button>
      </form>

      <ul className="mt-8 flex flex-col gap-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((w) => (
            <motion.li
              key={w.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="rounded-2xl border border-line bg-surface/70 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-medium text-primary-strong" aria-hidden>
                  {w.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 truncate font-medium">{w.name}</span>
                {w.attendance && <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] ${BADGE[w.attendance]}`}>{t(`att_${w.attendance}`)}</span>}
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-[0.95rem] text-ink/85">{w.message}</p>
              <p className="mt-2 text-xs text-muted">{relativeTime(w.createdAt, lang)}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!q.isLoading && items.length === 0 && <p className="mt-6 text-center text-sm text-muted">{t('noWishes')}</p>}
      {q.hasNextPage && (
        <div className="mt-6 text-center">
          <button type="button" className="btn btn-ghost" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {t('loadMore')}
          </button>
        </div>
      )}
    </Section>
  );
}
