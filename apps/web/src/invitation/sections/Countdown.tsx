import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { InvitationContent } from '@wedding/shared';
import { weddingStart } from '@wedding/shared/util';
import { useL } from '../../lib/i18n';
import { downloadIcs, googleCalendarUrl } from '../../lib/calendar';
import { Section, SectionTitle } from '../motion';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Unit({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[3.6rem] w-[4.2rem] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={v}
            className="display absolute inset-0 flex items-center justify-center text-[3rem] tabular-nums text-ink"
            initial={{ y: '60%', opacity: 0, rotateX: -60 }}
            animate={{ y: '0%', opacity: 1, rotateX: 0 }}
            exit={{ y: '-60%', opacity: 0, rotateX: 60 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {v}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
  );
}

export function Countdown({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  const { l } = useL();
  const now = useNow();
  const target = weddingStart(c).getTime();
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const first = c.events[0]!;
  const title = c.meta.title;
  const details = `${c.meta.description}\n${window.location.origin}`;

  return (
    <Section id="countdown" className="text-center">
      <SectionTitle>{t('countdown')}</SectionTitle>
      <div className="glass mx-auto flex max-w-[22rem] justify-between rounded-[2rem] px-4 py-6" style={{ perspective: 400 }} role="timer" aria-live="off">
        <Unit value={d} label={t('days')} />
        <Unit value={h} label={t('hours')} />
        <Unit value={m} label={t('minutes')} />
        <Unit value={s} label={t('seconds')} />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a className="btn btn-primary" href={googleCalendarUrl(first, `${title} · ${l(first.name)}`, details)} target="_blank" rel="noopener noreferrer">
          <CalendarPlus size={18} aria-hidden /> {t('googleCalendar')}
        </a>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => downloadIcs(c.events.map((e) => ({ e, title: `${title} · ${l(e.name)}` })), details)}
        >
          {t('downloadIcs')}
        </button>
      </div>
    </Section>
  );
}
