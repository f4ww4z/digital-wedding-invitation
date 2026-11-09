import { motion } from 'motion/react';
import { MailOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import type { InvitationContent } from '@sakinah/shared';
import { useL } from '../lib/i18n';
import { shortDate } from '../lib/format';
import { Depth } from './motion';
import { Bloom, CornerCluster, Sprig } from './ornaments/Florals';

/**
 * Cover gate. Scroll stays locked until the guest taps open, which also unlocks
 * audio playback (browsers block autoplay without a user gesture).
 * `backdrop` receives the 3D scene when WebGL is available.
 */
export function Cover({
  c,
  guestName,
  onOpen,
  opening,
  backdrop,
}: {
  c: InvitationContent;
  guestName: string;
  onOpen: () => void;
  opening: boolean;
  backdrop?: ReactNode;
}) {
  const { l } = useL();
  const [a, b] = c.couple.order === 'bride-first' ? [c.couple.bride, c.couple.groom] : [c.couple.groom, c.couple.bride];
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <motion.div
      className={`fixed inset-0 z-40 flex flex-col items-center overflow-hidden bg-bg sm:bg-transparent ${backdrop ? 'justify-end' : 'justify-center'}`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, delay: 0.6 } }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-title"
    >
      <div aria-hidden className="absolute inset-0 sm:hidden" style={{ background: 'radial-gradient(100% 60% at 50% 20%, var(--c-primary-soft), transparent 70%), radial-gradient(80% 50% at 50% 100%, var(--c-accent-soft), transparent 70%)' }} />
      {backdrop}

      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2">
      {/* 2.5D garden layers; these fly outward when the invitation opens */}
      <motion.div className="absolute -left-8 -top-8" animate={opening ? { x: -260, y: -200, rotate: -25, opacity: 0 } : {}} transition={{ duration: 1.3, ease }}>
        <Depth depth={0.8}>
          <CornerCluster />
        </Depth>
      </motion.div>
      <motion.div className="absolute -right-8 -top-8" animate={opening ? { x: 260, y: -200, rotate: 25, opacity: 0 } : {}} transition={{ duration: 1.3, ease }}>
        <Depth depth={0.7}>
          <CornerCluster flip scale={0.85} />
        </Depth>
      </motion.div>
      <motion.div className="absolute -bottom-16 -left-6" animate={opening ? { x: -200, y: 200, opacity: 0 } : {}} transition={{ duration: 1.3, ease }}>
        <Depth depth={1}>
          <Sprig length={220} rotate={25} />
        </Depth>
      </motion.div>
      <motion.div className="absolute -bottom-10 -right-10" animate={opening ? { x: 220, y: 220, opacity: 0 } : {}} transition={{ duration: 1.3, ease }}>
        <Depth depth={0.9}>
          <Bloom size={150} tone="rose" rotate={-15} />
        </Depth>
      </motion.div>
      </div>

      <motion.div
        className={`relative z-10 mx-6 flex max-w-[24rem] flex-col items-center text-center ${backdrop ? 'mt-auto mb-[max(6svh,2rem)]' : ''}`}
        animate={opening ? { scale: 1.25, opacity: 0, filter: 'blur(8px)' } : {}}
        transition={{ duration: 1, ease }}
      >
        <motion.p className="display-italic text-xl text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 1 }}>
          {l(c.cover.eyebrow)}
        </motion.p>
        <motion.h1
          id="cover-title"
          className="display-italic mt-4 text-[clamp(3rem,15vw,4.4rem)] text-ink"
          // Visible from the first frame (it's the LCP element); motion comes from rise + focus.
          initial={{ y: 18, filter: 'blur(6px)' }}
          animate={{ y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease }}
        >
          {a.nickname} <span className="text-primary">&amp;</span> {b.nickname}
        </motion.h1>
        <motion.p className="mt-3 text-sm tracking-[0.3em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          {c.events[0] ? shortDate(c.events[0]) : ''}
        </motion.p>
        <motion.div className={backdrop ? 'mt-7' : 'mt-12'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.9 }}>
          <p className="text-sm text-muted">{l(c.cover.guestPrefix)}</p>
          <p className="display mt-2 text-[1.9rem] font-medium text-ink">{guestName}</p>
        </motion.div>
        <motion.button
          type="button"
          onClick={onOpen}
          disabled={opening}
          className={`btn btn-primary ${backdrop ? 'mt-7' : 'mt-10'} !px-7 !py-3.5 shadow-[0_14px_30px_-12px_var(--c-primary)]`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 200, damping: 16 }}
          whileTap={{ scale: 0.95 }}
        >
          <MailOpen size={18} aria-hidden />
          {l(c.cover.openButton)}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
