/**
 * Colour adjustments as a single 4×5 colour matrix (the same shape SVG's feColorMatrix uses),
 * so the live preview (an SVG filter) and the exported pixels (applyMatrix) always match.
 * Values work on 0..1 channels; the fifth column is an offset.
 */

export type Matrix = number[]; // 20 numbers, row-major, rows R G B A

export type Adjust = {
  /** All −100..100, 0 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export const noAdjust = (): Adjust => ({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 });

export const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** a ∘ b: apply b first, then a. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out: number[] = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4]! : 0;
      for (let i = 0; i < 4; i++) v += a[r * 5 + i]! * b[i * 5 + c]!;
      out[r * 5 + c] = v;
    }
  }
  return out;
}

export function mix(a: Matrix, b: Matrix, t: number): Matrix {
  return a.map((v, i) => v + (b[i]! - v) * t);
}

function scaleOffset(sr: number, sg: number, sb: number, or = 0, og = 0, ob = 0): Matrix {
  return [sr, 0, 0, 0, or, 0, sg, 0, 0, og, 0, 0, sb, 0, ob, 0, 0, 0, 1, 0];
}

export function saturate(s: number): Matrix {
  return [
    LR + (1 - LR) * s,
    LG - LG * s,
    LB - LB * s,
    0,
    0,
    LR - LR * s,
    LG + (1 - LG) * s,
    LB - LB * s,
    0,
    0,
    LR - LR * s,
    LG - LG * s,
    LB + (1 - LB) * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

export function contrast(s: number): Matrix {
  const o = (1 - s) / 2;
  return scaleOffset(s, s, s, o, o, o);
}

export function brightness(b: number): Matrix {
  return scaleOffset(1 + b * 0.25, 1 + b * 0.25, 1 + b * 0.25, b * 0.12, b * 0.12, b * 0.12);
}

export function warmth(w: number): Matrix {
  return scaleOffset(1 + w * 0.1, 1 + w * 0.02, 1 - w * 0.12, w * 0.04, 0, -w * 0.03);
}

const SEPIA: Matrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
];

export type Preset = { id: string; label: string; matrix: Matrix };

export const PRESETS: Preset[] = [
  { id: 'none', label: 'Original', matrix: IDENTITY },
  { id: 'warm', label: 'Warm', matrix: multiply(warmth(0.7), saturate(1.1)) },
  {
    id: 'soft',
    label: 'Soft',
    matrix: multiply(brightness(0.25), multiply(contrast(0.82), saturate(0.85))),
  },
  {
    id: 'blush',
    label: 'Blush',
    matrix: multiply(scaleOffset(1.04, 0.98, 1.02, 0.05, 0.01, 0.03), contrast(0.94)),
  },
  {
    id: 'bright',
    label: 'Bright',
    matrix: multiply(brightness(0.35), multiply(contrast(1.08), saturate(1.08))),
  },
  { id: 'vintage', label: 'Vintage', matrix: multiply(contrast(0.88), mix(IDENTITY, SEPIA, 0.55)) },
  { id: 'cool', label: 'Cool', matrix: multiply(warmth(-0.7), saturate(0.95)) },
  { id: 'mono', label: 'B&W', matrix: multiply(contrast(1.12), saturate(0)) },
];

export function buildMatrix(adjust: Adjust, presetId: string, strength = 1): Matrix {
  const preset = PRESETS.find((p) => p.id === presetId)?.matrix ?? IDENTITY;
  const p = mix(IDENTITY, preset, strength);
  const a = multiply(
    warmth(adjust.warmth / 100),
    multiply(
      saturate(1 + adjust.saturation / 100),
      multiply(contrast(1 + (adjust.contrast / 100) * 0.7), brightness(adjust.brightness / 100)),
    ),
  );
  return multiply(a, p);
}

export function isIdentity(m: Matrix) {
  return m.every((v, i) => Math.abs(v - IDENTITY[i]!) < 1e-6);
}

/** Apply the matrix to RGBA bytes in place. */
export function applyMatrix(data: Uint8ClampedArray, m: Matrix) {
  const [a0, a1, a2, a3, a4, b0, b1, b2, b3, b4, c0, c1, c2, c3, c4, d0, d1, d2, d3, d4] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;
    const a = data[i + 3]! / 255;
    data[i] = (a0 * r + a1 * g + a2 * b + a3 * a + a4) * 255;
    data[i + 1] = (b0 * r + b1 * g + b2 * b + b3 * a + b4) * 255;
    data[i + 2] = (c0 * r + c1 * g + c2 * b + c3 * a + c4) * 255;
    data[i + 3] = (d0 * r + d1 * g + d2 * b + d3 * a + d4) * 255;
  }
}

/** feColorMatrix `values` attribute. */
export const toSvgValues = (m: Matrix) => m.map((v) => +v.toFixed(5)).join(' ');
