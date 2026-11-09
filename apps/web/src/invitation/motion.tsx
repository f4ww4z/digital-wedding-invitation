import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';

/* ------------------------------------------------------------------ */
/* Tilt: device orientation (phones) or pointer position (desktop)     */
/* drives a shared -1..1 motion value pair used by every depth layer.  */
/* ------------------------------------------------------------------ */

interface Tilt {
  x: MotionValue<number>;
  y: MotionValue<number>;
}
const TiltCtx = createContext<Tilt | null>(null);

export function TiltProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.6 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduce) return;
    let base: { b: number; g: number } | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      base ??= { b: e.beta, g: e.gamma };
      rawX.set(clamp((e.gamma - base.g) / 25));
      rawY.set(clamp((e.beta - base.b) / 25));
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      rawX.set(clamp((e.clientX / window.innerWidth) * 2 - 1));
      rawY.set(clamp((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [enabled, reduce, rawX, rawY]);

  const value = useMemo(() => ({ x, y }), [x, y]);
  return <TiltCtx.Provider value={value}>{children}</TiltCtx.Provider>;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/** iOS 13+ needs an explicit permission prompt from a user gesture. */
export async function requestMotionPermission(): Promise<void> {
  const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (typeof D?.requestPermission === 'function') {
    try {
      await D.requestPermission();
    } catch {
      /* user declined: pointer/scroll depth still works */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Depth: a layer that moves with scroll and tilt by its depth factor. */
/* depth > 0 = foreground (moves more), depth < 0 = background.        */
/* ------------------------------------------------------------------ */

export function Depth({
  depth,
  children,
  className,
  style,
}: {
  depth: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tilt = useContext(TiltCtx);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const scrollY = useTransform(scrollYProgress, [0, 1], [depth * 90, depth * -90]);
  const fallback = useMotionValue(0);
  const tx = useTransform(tilt?.x ?? fallback, (v) => v * depth * 14);
  const ty = useTransform(tilt?.y ?? fallback, (v) => v * depth * 10);
  const y = useTransform([scrollY, ty] as MotionValue<number>[], ([a, b]) => (a as number) + (b as number));

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ ...style, ...(reduce ? {} : { x: tx, y }), pointerEvents: 'none', willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Section shell                                                        */
/* ------------------------------------------------------------------ */

export function Section({
  id,
  children,
  className = '',
  decor,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  /** Absolutely-positioned ornament layers behind/around the content. */
  decor?: ReactNode;
}) {
  return (
    <section id={id} className={`relative isolate overflow-x-clip px-6 py-20 ${className}`}>
      {decor}
      <div className="relative z-10 mx-auto max-w-[26rem]">{children}</div>
    </section>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-10 text-center">
      <motion.h2
        className="display-italic text-[2.6rem] text-ink"
        initial={{ opacity: 0, letterSpacing: '0.08em' }}
        whileInView={{ opacity: 1, letterSpacing: '-0.015em' }}
        viewport={{ once: true, margin: '-15% 0px' }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.h2>
      {sub && <p className="mx-auto mt-3 max-w-[22rem] text-[0.95rem] text-muted">{sub}</p>}
    </header>
  );
}

/** Reveal that rises from slight depth (scale + blur), used sparingly. */
export function Reveal({
  children,
  delay = 0,
  className,
  from = 'depth',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  from?: 'depth' | 'left' | 'right';
}) {
  const initial =
    from === 'left'
      ? { opacity: 0, x: -24 }
      : from === 'right'
        ? { opacity: 0, x: 24 }
        : { opacity: 0, scale: 0.94, filter: 'blur(6px)' };
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
