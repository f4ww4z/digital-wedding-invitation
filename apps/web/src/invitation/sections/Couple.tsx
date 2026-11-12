import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { InvitationContent, Person } from '@wedding/shared';
import { useL } from '../../lib/i18n';
import { Depth, Section } from '../motion';
import { Bloom, Leaf } from '../ornaments/Florals';

function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Portrait({ p, side }: { p: Person; side: 'left' | 'right' }) {
  const { l } = useL();
  const { t } = useTranslation();
  return (
    <motion.article
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-15% 0px' }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative">
        {/* Arch portrait with a layered frame that sits at a different depth than the photo */}
        <Depth depth={-0.2} className="absolute -inset-3">
          <div className="arch h-full w-full border border-[color-mix(in_oklab,var(--c-primary)_40%,transparent)]" />
        </Depth>
        <motion.div
          className="arch relative h-[19rem] w-[14rem] overflow-hidden bg-primary-soft shadow-[0_30px_60px_-30px_rgb(61_51_69/0.5)]"
          initial={{ clipPath: 'inset(100% 0 0 0 round 999px 999px 28px 28px)' }}
          whileInView={{ clipPath: 'inset(0% 0 0 0 round 999px 999px 28px 28px)' }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {p.photo && <img src={p.photo} alt={p.fullName} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
        </motion.div>
        <Depth depth={0.7} className={`absolute -bottom-6 ${side === 'left' ? '-left-10' : '-right-10'}`}>
          <Bloom size={92} tone={side === 'left' ? 'rose' : 'blush'} rotate={side === 'left' ? 10 : -30} />
        </Depth>
        <Depth depth={0.5} className={`absolute bottom-6 ${side === 'left' ? '-right-6' : '-left-6'}`}>
          <Leaf length={60} rotate={side === 'left' ? 40 : -40} />
        </Depth>
      </div>
      <h3 className="display-italic mt-10 text-[3.2rem] text-ink">{p.nickname}</h3>
      <p className="display mt-1 text-[1.25rem] font-medium">{p.fullName}</p>
      <p className="mt-3 text-[0.95rem] text-muted">{l(p.childOrder)}</p>
      <p className="text-[0.95rem] text-ink/80">{l(p.parents)}</p>
      {p.instagram && (
        <a
          href={`https://instagram.com/${encodeURIComponent(p.instagram)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost mt-5 !py-2 text-sm"
          aria-label={t('instagram', { handle: p.instagram })}
        >
          <InstagramGlyph /> @{p.instagram}
        </a>
      )}
    </motion.article>
  );
}

export function Couple({ c }: { c: InvitationContent }) {
  const [a, b] = c.couple.order === 'bride-first' ? [c.couple.bride, c.couple.groom] : [c.couple.groom, c.couple.bride];
  return (
    <Section id="couple">
      <div className="flex flex-col items-center gap-14">
        <Portrait p={a} side="left" />
        <span className="display-italic text-[3.5rem] leading-none text-primary" aria-hidden>
          &amp;
        </span>
        <Portrait p={b} side="right" />
      </div>
    </Section>
  );
}
