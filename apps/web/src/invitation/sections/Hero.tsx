import { motion } from 'motion/react';
import type { InvitationContent } from '@sakinah/shared';
import { useL } from '../../lib/i18n';
import { shortDate } from '../../lib/format';
import { Depth } from '../motion';
import { Bloom, CornerCluster, Leaf, Sprig } from '../ornaments/Florals';

/** First screen after the envelope opens: names drawn in, layered garden around them. */
export function Hero({ c }: { c: InvitationContent }) {
  const { l } = useL();
  const [first, second] = c.couple.order === 'bride-first' ? [c.couple.bride, c.couple.groom] : [c.couple.groom, c.couple.bride];
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <section id="home" className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-6">
      {/* back layer: soft sky wash and distant blooms */}
      <div aria-hidden className="absolute inset-0 -z-20" style={{ background: 'radial-gradient(120% 70% at 50% 0%, var(--c-primary-soft), transparent 60%), radial-gradient(90% 60% at 50% 110%, var(--c-accent-soft), transparent 70%)' }} />
      <Depth depth={-0.4} className="absolute -left-10 top-[18%] -z-10 opacity-50">
        <Bloom size={90} tone="blush" />
      </Depth>
      <Depth depth={-0.3} className="absolute -right-8 top-[58%] -z-10 opacity-50">
        <Bloom size={70} tone="mauve" rotate={30} />
      </Depth>
      {/* mid: arch outline */}
      <Depth depth={-0.15} className="absolute inset-x-8 top-[12%] bottom-[14%] -z-10">
        <div className="arch h-full w-full border border-[color-mix(in_oklab,var(--c-primary)_35%,transparent)]" />
        <div className="arch absolute inset-3 border border-[color-mix(in_oklab,var(--c-accent)_25%,transparent)]" />
      </Depth>
      {/* front: corner clusters */}
      <Depth depth={0.6} className="absolute -left-6 -top-6">
        <CornerCluster scale={0.95} />
      </Depth>
      <Depth depth={0.7} className="absolute -right-6 -top-6">
        <CornerCluster flip scale={0.8} />
      </Depth>
      <Depth depth={0.9} className="absolute -bottom-10 -left-4">
        <Sprig length={190} rotate={20} />
      </Depth>
      <Depth depth={0.8} className="absolute -bottom-6 right-2">
        <Leaf length={110} rotate={-25} tone="deep" />
      </Depth>

      <div className="relative text-center">
        <motion.p
          className="display-italic text-xl text-muted"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease }}
        >
          {l(c.cover.eyebrow)}
        </motion.p>
        <h1 className="mt-6 flex flex-col items-center text-ink">
          <motion.span
            className="display-italic block text-[clamp(3.6rem,19vw,5.5rem)]"
            initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 1.6, delay: 0.5, ease }}
          >
            {first.nickname}
          </motion.span>
          <motion.span
            className="display-italic my-1 block text-[2.6rem] text-primary"
            initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 1.4, ease }}
          >
            &amp;
          </motion.span>
          <motion.span
            className="display-italic block text-[clamp(3.6rem,19vw,5.5rem)]"
            initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0 0%)' }}
            transition={{ duration: 1.6, delay: 1.7, ease }}
          >
            {second.nickname}
          </motion.span>
        </h1>
        <motion.p
          className="mt-8 font-sans text-sm tracking-[0.3em] text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 2.6 }}
        >
          {c.events[0] ? shortDate(c.events[0]) : ''}
        </motion.p>
      </div>
    </section>
  );
}
