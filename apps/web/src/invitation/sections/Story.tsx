import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useSpring } from 'motion/react';
import type { InvitationContent } from '@sakinah/shared';
import { useL } from '../../lib/i18n';
import { Section, SectionTitle } from '../motion';
import { Bloom } from '../ornaments/Florals';

/** Vertical timeline; the stem grows with scroll progress, and each milestone blooms when reached. */
export function Story({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  const { l } = useL();
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const grow = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });

  return (
    <Section id="story">
      <SectionTitle>{t('story')}</SectionTitle>
      <ol ref={ref} className="relative ml-4 border-l border-transparent">
        <div aria-hidden className="absolute -left-px top-0 h-full w-px bg-line" />
        <motion.div aria-hidden className="absolute -left-px top-0 h-full w-px origin-top bg-accent" style={{ scaleY: grow }} />
        {c.story.items.map((s, i) => (
          <li key={i} className="relative pb-12 pl-8 last:pb-0">
            <motion.div
              className="absolute -left-[13px] top-0"
              initial={{ scale: 0, rotate: -90 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true, margin: '-35% 0px' }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
            >
              <Bloom size={26} tone={i % 2 ? 'blush' : 'rose'} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-25% 0px' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-sm text-accent">{l(s.date)}</p>
              <h3 className="display-italic mt-1 text-[1.9rem]">{l(s.title)}</h3>
              {s.image && (
                <img src={s.image} alt="" loading="lazy" decoding="async" className="mt-4 aspect-[4/3] w-full rounded-2xl object-cover" />
              )}
              <p className="mt-3 text-[0.97rem] text-ink/80">{l(s.text)}</p>
            </motion.div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
