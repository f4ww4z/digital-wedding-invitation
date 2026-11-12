import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { CalendarPlus, Clock, Map as MapIcon, MapPin } from 'lucide-react';
import type { InvitationContent, WeddingEvent } from '@wedding/shared';
import { useL } from '../../lib/i18n';
import { eventDateParts } from '../../lib/format';
import { googleCalendarUrl } from '../../lib/calendar';
import { Depth, Section, SectionTitle } from '../motion';
import { Bloom, Sprig } from '../ornaments/Florals';

/** Waze mark, drawn inline (lucide has no brand icons). */
function WazeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.2 17.4C4 16.6 2.6 14.7 2.6 12.4 2.6 7.6 6.8 4 11.9 4c5.2 0 9.4 3.6 9.4 8.2 0 3.1-1.9 5.4-4.6 6.3" />
      <path d="M9.6 18.6h4.6" />
      <circle cx="7.9" cy="18.7" r="1.7" />
      <circle cx="15.9" cy="18.7" r="1.7" />
      <circle cx="9.4" cy="10.2" r="0.6" fill="currentColor" />
      <circle cx="14.6" cy="10.2" r="0.6" fill="currentColor" />
      <path d="M9.2 13.2c1.5 1.4 4 1.4 5.6 0" />
    </svg>
  );
}

/** Deep link that opens Waze navigation (app if installed, website otherwise). */
function wazeUrl(e: WeddingEvent): string {
  const q = e.mapsEmbedQuery || [e.venue, e.address].filter(Boolean).join(', ');
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
}

function EventCard({ e, c, index }: { e: WeddingEvent; c: InvitationContent; index: number }) {
  const { t } = useTranslation();
  const { l, lang } = useL();
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
      <a
        href={googleCalendarUrl(e, `${c.meta.title} · ${l(e.name)}`, window.location.origin)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost mt-4 !px-4 !py-2 text-sm"
      >
        <CalendarPlus size={16} aria-hidden /> {t('saveTheDate')}
      </a>
      <div className="mt-6">
        <p className="flex items-center justify-center gap-2 font-medium">
          <MapPin size={16} className="text-accent" aria-hidden />
          {e.venue}
        </p>
        <p className="mx-auto mt-1 max-w-[18rem] text-sm text-ink/75">{e.address}</p>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {e.mapsUrl && (
          <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary shrink-0 !px-4 !py-2.5 text-sm">
            <MapIcon size={16} aria-hidden /> {t('openMaps')}
          </a>
        )}
        {(e.mapsEmbedQuery || e.address) && (
          <a href={wazeUrl(e)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost shrink-0 !px-4 !py-2.5 text-sm">
            <WazeIcon /> Waze
          </a>
        )}
      </div>
      {e.mapsEmbedQuery && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line">
          <iframe
            title={`${t('showMap')}: ${e.venue}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(e.mapsEmbedQuery)}&output=embed`}
            className="h-[200px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}
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
