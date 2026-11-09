import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarPlus, Clock, MapPin, Navigation } from 'lucide-react';
import type { InvitationContent, WeddingEvent } from '@sakinah/shared';
import { useL } from '../../lib/i18n';
import { eventDateParts } from '../../lib/format';
import { googleCalendarUrl } from '../../lib/calendar';
import { Depth, Section, SectionTitle } from '../motion';
import { Bloom, Sprig } from '../ornaments/Florals';

function EventCard({ e, c, index }: { e: WeddingEvent; c: InvitationContent; index: number }) {
  const { t } = useTranslation();
  const { l, lang } = useL();
  const [showMap, setShowMap] = useState(false);
  const p = eventDateParts(e, lang);
  const end = e.endTime ? t('until', { end: e.endTime }) : t('untilDone');
  return (
    <motion.article
      className="glass arch relative px-7 pb-8 pt-16 text-center"
      initial={{ opacity: 0, rotateX: 18, y: 40 }}
      whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      style={{ transformPerspective: 900 }}
    >
      <Depth depth={0.6} className={`absolute -top-6 ${index % 2 ? '-left-6' : '-right-6'}`}>
        <Bloom size={70} tone={index % 2 ? 'blush' : 'rose'} rotate={index * 40} />
      </Depth>
      <h3 className="display-italic text-[2.6rem] text-ink">{l(e.name)}</h3>
      <div className="mt-6 flex items-center justify-center gap-4">
        <span className="text-right text-sm leading-tight text-muted">{p.weekday}</span>
        <span className="display border-x border-line px-4 text-[3.4rem] leading-none text-primary">{p.day}</span>
        <span className="text-left text-sm leading-tight text-muted">
          {p.month}
          <br />
          {p.year}
        </span>
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-[0.95rem]">
        <Clock size={16} className="text-accent" aria-hidden />
        {t('time', { start: e.startTime, end, tz: e.timezoneLabel })}
      </p>
      <div className="mt-6">
        <p className="flex items-center justify-center gap-2 font-medium">
          <MapPin size={16} className="text-accent" aria-hidden />
          {e.venue}
        </p>
        <p className="mx-auto mt-1 max-w-[18rem] text-sm text-ink/75">{e.address}</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {e.mapsUrl && (
          <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary !py-2.5 text-sm">
            <Navigation size={16} aria-hidden /> {t('openMaps')}
          </a>
        )}
        {e.mapsEmbedQuery && (
          <button type="button" className="btn btn-ghost !py-2.5 text-sm" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
            {showMap ? t('hideMap') : t('showMap')}
          </button>
        )}
        <a
          href={googleCalendarUrl(e, `${c.meta.title} · ${l(e.name)}`, window.location.origin)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost !px-3 !py-2.5 text-sm"
          aria-label={t('saveTheDate')}
          title={t('saveTheDate')}
        >
          <CalendarPlus size={16} aria-hidden />
        </a>
      </div>
      <AnimatePresence>
        {showMap && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 220, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-5 overflow-hidden rounded-2xl">
            <iframe
              title={`${t('showMap')}: ${e.venue}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(e.mapsEmbedQuery)}&output=embed`}
              className="h-[220px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function Events({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  return (
    <Section
      id="events"
      decor={
        <Depth depth={-0.3} className="absolute -right-10 top-24 opacity-70">
          <Sprig length={200} rotate={200} />
        </Depth>
      }
    >
      <SectionTitle>{t('events')}</SectionTitle>
      <div className="flex flex-col gap-10">
        {c.events.map((e, i) => (
          <EventCard key={e.id} e={e} c={c} index={i} />
        ))}
      </div>
    </Section>
  );
}
