import { describe, expect, it } from 'vitest';
import {
  applyMatrix,
  buildMatrix,
  IDENTITY,
  isIdentity,
  multiply,
  noAdjust,
  saturate,
} from './color';
import {
  clampTransform,
  fitAspect,
  identityTransform,
  minScale,
  outputSize,
  pan,
  zoomAt,
} from './geometry';

describe('colour matrix', () => {
  it('is the identity with no adjustments and no filter', () => {
    expect(isIdentity(buildMatrix(noAdjust(), 'none'))).toBe(true);
    expect(isIdentity(buildMatrix(noAdjust(), 'mono', 0))).toBe(true);
  });

  it('composes with the identity', () => {
    const s = saturate(0.4);
    expect(multiply(IDENTITY, s)).toEqual(s);
    expect(multiply(s, IDENTITY)).toEqual(s);
  });

  it('turns colour grey with saturation −100', () => {
    const px = new Uint8ClampedArray([200, 40, 90, 255]);
    applyMatrix(px, buildMatrix({ ...noAdjust(), saturation: -100 }, 'none'));
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[3]).toBe(255);
  });

  it('brightens', () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255]);
    applyMatrix(px, buildMatrix({ ...noAdjust(), brightness: 50 }, 'none'));
    expect(px[0]).toBeGreaterThan(100);
  });
});

describe('crop geometry', () => {
  it('fills the frame at zoom 1', () => {
    // 2000×1000 image into a 300×300 square frame: the short side must cover.
    expect(minScale(2000, 1000, 300, 300, 0)).toBeCloseTo(0.3);
    // Straightening needs extra zoom so no corners show.
    expect(minScale(2000, 1000, 300, 300, 10)).toBeGreaterThan(0.3);
  });

  it('keeps the frame inside the image when panning too far', () => {
    const t = clampTransform({ ...identityTransform(), cx: 5000, cy: -5000 }, 2000, 1000, 300, 300);
    // k = 0.3 → crop is 1000×1000 image px, so the centre can move ±500 horizontally, 0 vertically.
    expect(t.cx).toBeCloseTo(500);
    expect(t.cy).toBeCloseTo(0);
  });

  it('pans opposite to the drag in image space', () => {
    const t = pan(identityTransform(), 30, 0, 0.3);
    expect(t.cx).toBeCloseTo(-100);
  });

  it('zooms around the anchor point', () => {
    const k = 0.3;
    const t = zoomAt(identityTransform(), 2, 60, 0, k);
    // The image point under the anchor (offset 60 view px = 200 image px) stays under it.
    const before = 0 + 60 / k;
    const after = t.cx + 60 / (k * 2);
    expect(after).toBeCloseTo(before);
  });

  it('fits aspect boxes and caps the export size', () => {
    expect(fitAspect(1, 400, 300)).toEqual({ w: 300, h: 300 });
    expect(outputSize(300, 400, 0.05)).toEqual({ w: 1800, h: 2400 });
    expect(outputSize(300, 400, 1)).toEqual({ w: 300, h: 400 });
  });
});
