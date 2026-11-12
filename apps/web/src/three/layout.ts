/**
 * Shared cover geometry so the HTML open handle lines up with the 3D wax seal.
 * Kept free of three.js imports so the cover can use it before the 3D chunk loads.
 */
export const CAMERA_Z = 7;
export const CAMERA_FOV = 35;
export const ENV_W = 3.2; // envelope width (world units)
export const ENV_H = 2.1; // envelope height
/** Seal centre in envelope-local units (below the envelope's centre). */
export const SEAL_LOCAL_Y = ENV_H / 2 - ENV_H * 0.62;
/** Seal centre as a fraction of the cover's height. */
export const SEAL_Y = 0.665;

/** World-space viewport and envelope scale for a canvas of `w`×`h` CSS pixels. */
export function envelopeLayout(w: number, h: number) {
  const worldH = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const worldW = worldH * (w / Math.max(h, 1));
  const scale = Math.min(0.95, (worldW * 0.8) / ENV_W, (worldH * 0.32) / ENV_H);
  const pxPerWorld = h / worldH;
  const sealPx = h * SEAL_Y;
  return {
    scale,
    /** Envelope group Y (world) that puts the seal at SEAL_Y. */
    homeY: (0.5 - SEAL_Y) * worldH - SEAL_LOCAL_Y * scale,
    sealPx,
    sealRadiusPx: 0.3 * scale * pxPerWorld,
    /** Pixel Y of the envelope's top edge. */
    topPx: sealPx - (ENV_H / 2 - SEAL_LOCAL_Y) * scale * pxPerWorld,
    /** Pixel Y of the envelope's bottom edge. */
    bottomPx: sealPx + (ENV_H / 2 + SEAL_LOCAL_Y) * scale * pxPerWorld,
  };
}
