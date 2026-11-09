import { useId, type CSSProperties } from 'react';

/**
 * Hand-built vector florals (no raster assets, no licensing questions).
 * Colors derive from the theme via CSS variables so admins re-color everything at once.
 */

type Tone = 'rose' | 'blush' | 'cream' | 'mauve';

const TONES: Record<Tone, [string, string, string]> = {
  // [outer, mid, heart] — mixed from theme primary so a palette change re-tints blooms
  rose: [
    'color-mix(in oklab, var(--c-primary) 55%, white)',
    'color-mix(in oklab, var(--c-primary) 85%, white)',
    'color-mix(in oklab, var(--c-primary) 80%, #5a2a3a)',
  ],
  blush: [
    'color-mix(in oklab, var(--c-primary) 22%, white)',
    'color-mix(in oklab, var(--c-primary) 45%, white)',
    'color-mix(in oklab, var(--c-primary) 75%, white)',
  ],
  cream: ['#fffdf8', '#f6eadf', 'color-mix(in oklab, #e8c9a8 70%, var(--c-primary))'],
  mauve: [
    'color-mix(in oklab, #a58fb5 35%, white)',
    'color-mix(in oklab, #a58fb5 65%, white)',
    'color-mix(in oklab, #a58fb5 90%, #3d3345)',
  ],
};

function petalPath(len: number, wid: number) {
  // A soft cupped petal pointing up from the origin.
  return `M0 0 C ${-wid} ${-len * 0.35}, ${-wid * 0.8} ${-len}, 0 ${-len} C ${wid * 0.8} ${-len}, ${wid} ${-len * 0.35}, 0 0 Z`;
}

export function Bloom({ size = 120, tone = 'rose', rotate = 0, style }: { size?: number; tone?: Tone; rotate?: number; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  const [outer, mid, heart] = TONES[tone];
  const ring = (n: number, len: number, wid: number, fill: string, offset = 0, opacity = 1) =>
    Array.from({ length: n }, (_, i) => (
      <path key={i} d={petalPath(len, wid)} style={{ fill: fill }} opacity={opacity} transform={`rotate(${(360 / n) * i + offset})`} />
    ));
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ transform: `rotate(${rotate}deg)`, overflow: 'visible', ...style }} aria-hidden="true">
      <defs>
        <radialGradient id={`o${id}`} cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0.25" style={{ stopColor: mid }} />
          <stop offset="1" style={{ stopColor: outer }} />
        </radialGradient>
        <radialGradient id={`m${id}`} cx="0" cy="0" r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: heart }} />
          <stop offset="1" style={{ stopColor: mid }} />
        </radialGradient>
      </defs>
      <g>{ring(7, 46, 24, `url(#o${id})`, 0, 0.95)}</g>
      <g>{ring(6, 34, 19, `url(#m${id})`, 26, 0.95)}</g>
      <g>{ring(5, 22, 13, `url(#m${id})`, 8)}</g>
      <path d="M-9 2 C -10 -8, 4 -12, 8 -4 C 11 3, 2 9, -3 6 C -7 4, -5 -3, 1 -3" fill="none" style={{ stroke: heart }} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function Leaf({ length = 70, rotate = 0, tone = 'sage', style }: { length?: number; rotate?: number; tone?: 'sage' | 'deep' | 'pale'; style?: CSSProperties }) {
  const fill =
    tone === 'deep'
      ? 'color-mix(in oklab, var(--c-accent) 85%, #1f3a2a)'
      : tone === 'pale'
        ? 'color-mix(in oklab, var(--c-accent) 40%, white)'
        : 'var(--c-accent)';
  return (
    <svg width={length * 0.5} height={length} viewBox="-20 -80 40 80" style={{ transform: `rotate(${rotate}deg)`, transformOrigin: '50% 100%', overflow: 'visible', ...style }} aria-hidden="true">
      <path d="M0 0 C -18 -20, -16 -58, 0 -78 C 16 -58, 18 -20, 0 0 Z" style={{ fill: fill }} opacity="0.92" />
      <path d="M0 -2 L0 -72" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
    </svg>
  );
}

/** Eucalyptus-style sprig: a stem with paired round leaves. */
export function Sprig({ length = 160, rotate = 0, style }: { length?: number; rotate?: number; style?: CSSProperties }) {
  const n = 6;
  return (
    <svg width={length * 0.45} height={length} viewBox="-36 -160 72 160" style={{ transform: `rotate(${rotate}deg)`, transformOrigin: '50% 100%', overflow: 'visible', ...style }} aria-hidden="true">
      <path d="M0 0 C 4 -50, -4 -100, 2 -158" style={{ stroke: 'color-mix(in oklab, var(--c-accent) 70%, #2d3b30)' }} strokeWidth="1.6" fill="none" />
      {Array.from({ length: n }, (_, i) => {
        const y = -18 - i * 24;
        const r = 13 - i * 1.3;
        return (
          <g key={i}>
            <ellipse cx={-r - 1} cy={y} rx={r} ry={r * 0.82} style={{ fill: 'color-mix(in oklab, var(--c-accent) 55%, #c9d6cc)' }} opacity="0.9" />
            <ellipse cx={r + 1} cy={y - 8} rx={r} ry={r * 0.82} style={{ fill: 'color-mix(in oklab, var(--c-accent) 45%, #dfe8e1)' }} opacity="0.9" />
          </g>
        );
      })}
    </svg>
  );
}

/** Tiny gypsophila dots. */
export function Babybreath({ size = 70, style }: { size?: number; style?: CSSProperties }) {
  const pts = [
    [0, -30], [-14, -22], [12, -20], [-6, -12], [20, -34], [-22, -36], [6, -40], [-2, -26],
  ];
  return (
    <svg width={size} height={size} viewBox="-35 -50 70 55" style={{ overflow: 'visible', ...style }} aria-hidden="true">
      {pts.map(([x, y], i) => (
        <g key={i}>
          <path d={`M0 0 Q ${x! / 2} ${y! / 2 + 6} ${x} ${y}`} style={{ stroke: 'color-mix(in oklab, var(--c-accent) 60%, #6d7d70)' }} strokeWidth="0.8" fill="none" />
          <circle cx={x} cy={y} r={2.6} fill="white" />
          <circle cx={x} cy={y} r={1.1} style={{ fill: 'color-mix(in oklab, var(--c-primary) 30%, white)' }} />
        </g>
      ))}
    </svg>
  );
}

/** A full corner arrangement. `flip` mirrors it for the opposite corner. */
export function CornerCluster({ flip = false, scale = 1, style }: { flip?: boolean; scale?: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'relative', width: 220 * scale, height: 220 * scale, transform: `${flip ? 'scaleX(-1)' : ''} scale(${scale})`, transformOrigin: flip ? 'top right' : 'top left', pointerEvents: 'none', ...style }}
    >
      <Sprig length={170} rotate={-120} style={{ position: 'absolute', left: 70, top: -20 }} />
      <Leaf length={80} rotate={-150} tone="deep" style={{ position: 'absolute', left: 120, top: 10 }} />
      <Leaf length={70} rotate={170} tone="sage" style={{ position: 'absolute', left: 10, top: 90 }} />
      <Leaf length={60} rotate={-95} tone="pale" style={{ position: 'absolute', left: 150, top: 40 }} />
      <Bloom size={128} tone="rose" rotate={12} style={{ position: 'absolute', left: -34, top: -30 }} />
      <Bloom size={84} tone="blush" rotate={-20} style={{ position: 'absolute', left: 74, top: 18 }} />
      <Bloom size={66} tone="cream" rotate={40} style={{ position: 'absolute', left: 6, top: 82 }} />
      <Bloom size={40} tone="mauve" rotate={0} style={{ position: 'absolute', left: 126, top: 70 }} />
      <Babybreath size={70} style={{ position: 'absolute', left: 120, top: 110 }} />
    </div>
  );
}

/** Horizontal floral divider for between sections. */
export function FloralDivider({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <span style={{ height: 1, width: 64, background: 'linear-gradient(to right, transparent, var(--c-line))' }} />
      <Leaf length={22} rotate={-70} tone="sage" />
      <Bloom size={26} tone="rose" />
      <Leaf length={22} rotate={70} tone="sage" />
      <span style={{ height: 1, width: 64, background: 'linear-gradient(to left, transparent, var(--c-line))' }} />
    </div>
  );
}
