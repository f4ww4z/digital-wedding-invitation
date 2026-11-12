import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react';
import { ChevronsUp, MailOpen } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvitationContent } from '@sakinah/shared';
import { useL } from '../lib/i18n';
import { shortDate } from '../lib/format';
import { envelopeLayout } from '../three/layout';
import { Depth } from './motion';
import { Bloom, CornerCluster, Sprig } from './ornaments/Florals';

/** How far (as a share of screen height) a full swipe travels, and where it commits. */
const SWIPE_DISTANCE = 0.32;
export const SWIPE_COMMIT = 0.45;
const TAP_SLOP = 8;

function useViewport() {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

/**
 * Cover gate. Scroll stays locked until the guest opens it, which also unlocks
 * audio playback (browsers block autoplay without a user gesture).
 * Tap the seal to open, or swipe up to peel the envelope open by hand: past
 * SWIPE_COMMIT it finishes by itself, otherwise it springs back closed.
 * `backdrop` receives the 3D scene when WebGL is available; it reads `progress`.
 */
export function Cover({
  c,
  guestName,
  onOpen,
  opening,
  progress,
  backdrop,
}: {
  c: InvitationContent;
  guestName: string;
  onOpen: () => void;
  opening: boolean;
  progress: RefObject<number>;
  backdrop?: ReactNode;
}) {
  const { l } = useL();
  const { t } = useTranslation();
  const [a, b] = c.couple.order === 'bride-first' ? [c.couple.bride, c.couple.groom] : [c.couple.groom, c.couple.bride];
  const ease = [0.22, 1, 0.36, 1] as const;
  const vp = useViewport();
  const lay = envelopeLayout(vp.w, vp.h);

  const prog = useMotionValue(0);
  const textOpacity = useTransform(prog, [0, 0.7], [1, 0.25]);
  const textY = useTransform(prog, [0, 1], [0, -36]);
  const hintOpacity = useTransform(prog, [0, 0.25], [1, 0]);
  const handleY = useTransform(prog, [0, 1], [0, -lay.sealRadiusPx * 2]);
  const setProgress = (v: number) => {
    progress.current = v;
    prog.set(v);
  };
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const settle = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => () => settle.current?.stop(), []);

  const springBack = () => {
    settle.current = animate(prog, 0, {
      type: 'spring',
      stiffness: 240,
      damping: 24,
      onUpdate: (v) => (progress.current = v),
    });
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (opening || e.button !== 0) return;
    settle.current?.stop();
    drag.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > TAP_SLOP) d.moved = true;
    if (d.moved) setProgress(Math.max(0, Math.min(1, dy / (SWIPE_DISTANCE * window.innerHeight))));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved || (progress.current ?? 0) >= SWIPE_COMMIT) {
      animate(prog, 1, { duration: 0.8, ease });
      onOpen();
    } else springBack();
  };
  const onPointerCancel = () => {
    if (!drag.current) return;
    drag.current = null;
    springBack();
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center overflow-hidden bg-bg sm:bg-transparent"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, delay: 0.5 } }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-title"
    >
      <div aria-hidden className="absolute inset-0 sm:hidden" style={{ background: 'radial-gradient(100% 60% at 50% 15%, var(--c-primary-soft), transparent 70%), radial-gradient(80% 50% at 50% 85%, var(--c-accent-soft), transparent 70%)' }} />
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

      {/* Names and greeting sit on top; the envelope lives in the lower half. */}
      <motion.div className="relative z-10 mx-6 mt-[max(11svh,3rem)] flex max-w-[24rem] flex-col items-center text-center" style={{ opacity: textOpacity, y: textY }}>
        <motion.div
          className="flex flex-col items-center"
          animate={opening ? { scale: 1.15, opacity: 0, filter: 'blur(8px)' } : {}}
          transition={{ duration: 0.9, ease }}
        >
          <motion.p className="display-italic text-xl text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 1 }}>
            {l(c.cover.eyebrow)}
          </motion.p>
          <motion.h1
            id="cover-title"
            className="display-italic mt-3 text-[clamp(2.8rem,14vw,4.2rem)] text-ink"
            // Visible from the first frame (it's the LCP element); motion comes from rise + focus.
            initial={{ y: 18, filter: 'blur(6px)' }}
            animate={{ y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease }}
          >
            {a.nickname} <span className="text-primary">&amp;</span> {b.nickname}
          </motion.h1>
          <motion.p className="mt-2 text-sm tracking-[0.3em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            {c.events[0] ? shortDate(c.events[0]) : ''}
          </motion.p>
          <motion.div className="mt-[min(5svh,2.5rem)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.9 }}>
            <p className="text-sm text-muted">{l(c.cover.guestPrefix)}</p>
            <p className="display mt-1 text-[1.8rem] font-medium text-ink">{guestName}</p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Swipe surface over the envelope. The seal button opens on tap / keyboard. */}
      <div
        data-testid="open-handle"
        className="absolute inset-x-0 bottom-0 z-20 select-none"
        style={{ top: Math.max(0, lay.sealPx - lay.sealRadiusPx * 5), touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <motion.div
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ top: lay.sealRadiusPx * 5, y: handleY }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={opening ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
          transition={opening ? { duration: 0.3 } : { delay: 1.4, type: 'spring', stiffness: 200, damping: 16 }}
        >
          <button
            type="button"
            disabled={opening}
            // Pointer taps are handled by the swipe surface; this covers keyboard activation.
            onClick={(e) => e.detail === 0 && onOpen()}
            aria-label={l(c.cover.openButton)}
            className="relative grid place-items-center rounded-full"
            style={{ width: lay.sealRadiusPx * 2.6, height: lay.sealRadiusPx * 2.6 }}
          >
            {/* pulsing halo around the wax seal; fades as soon as a swipe starts */}
            <motion.span aria-hidden className="absolute inset-0" style={{ opacity: hintOpacity }}>
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-primary/60"
                animate={{ scale: [0.85, 1.35], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
              <span className="absolute inset-[12%] rounded-full shadow-[0_0_0_1px_rgb(255_255_255/0.5),0_0_24px_4px_var(--c-primary-soft)]" />
            </motion.span>
            {!backdrop && (
              <span aria-hidden className="grid h-full w-full place-items-center rounded-full bg-primary text-white shadow-lg">
                <MailOpen size={22} />
              </span>
            )}
          </button>
        </motion.div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 whitespace-nowrap"
          style={{ top: Math.min(lay.bottomPx - lay.sealPx, vp.h * 0.24) + lay.sealRadiusPx * 5 + 14, opacity: hintOpacity }}
          initial={{ opacity: 0 }}
          animate={opening ? { opacity: 0 } : { opacity: 1 }}
          transition={{ delay: opening ? 0 : 1.8, duration: 0.6 }}
        >
          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} className="text-primary">
            <ChevronsUp size={20} />
          </motion.span>
          <span className="glass rounded-full px-4 py-1.5 text-sm font-medium text-ink shadow-sm">
            <MailOpen size={15} className="mr-1.5 inline -translate-y-px text-primary" />
            {l(c.cover.openButton)}
          </span>
          <span className="text-xs text-muted">{t('swipeHint')}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
