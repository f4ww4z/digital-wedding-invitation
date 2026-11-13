/**
 * Crop geometry for the image editor.
 *
 * Coordinates:
 * - "natural": the decoded image, origin at its centre, size nw × nh.
 * - "oriented": after the quarter-turn rotation and flips, origin at its centre, size W × H.
 *   The crop centre `cx, cy` lives here.
 * - "view": the stage (or output canvas). The crop frame is axis-aligned and centred in it,
 *   `k` view pixels per image pixel, and the image is turned by the fine `angle`.
 *
 * view = frameCentre + k · R(angle) · (oriented − c)
 */

export type Transform = {
  /** Quarter turns clockwise, 0..3. */
  quarter: number;
  flipX: boolean;
  flipY: boolean;
  /** Fine straighten angle in degrees, −45..45. */
  angle: number;
  /** Zoom relative to the smallest scale that still fills the frame (≥ 1). */
  zoom: number;
  /** Crop centre in oriented image pixels (0,0 = image centre). */
  cx: number;
  cy: number;
};

export const MAX_ZOOM = 8;

export const identityTransform = (): Transform => ({
  quarter: 0,
  flipX: false,
  flipY: false,
  angle: 0,
  zoom: 1,
  cx: 0,
  cy: 0,
});

export function orientedSize(nw: number, nh: number, quarter: number) {
  return quarter % 2 === 1 ? { W: nh, H: nw } : { W: nw, H: nh };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Half-extent of the rotated frame measured along the oriented image axes, in view pixels. */
function frameExtents(fw: number, fh: number, angle: number) {
  const c = Math.abs(Math.cos(rad(angle)));
  const s = Math.abs(Math.sin(rad(angle)));
  return { ex: (fw * c + fh * s) / 2, ey: (fw * s + fh * c) / 2 };
}

/** Smallest view-pixels-per-image-pixel scale at which the image still covers the whole frame. */
export function minScale(W: number, H: number, fw: number, fh: number, angle: number) {
  const { ex, ey } = frameExtents(fw, fh, angle);
  return Math.max((2 * ex) / W, (2 * ey) / H);
}

export function scaleOf(t: Transform, W: number, H: number, fw: number, fh: number) {
  return minScale(W, H, fw, fh, t.angle) * t.zoom;
}

/** Keep zoom in range and the crop centre where the frame stays fully covered by the image. */
export function clampTransform(
  t: Transform,
  W: number,
  H: number,
  fw: number,
  fh: number,
): Transform {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(t.zoom) ? t.zoom : 1));
  const k = minScale(W, H, fw, fh, t.angle) * zoom;
  const { ex, ey } = frameExtents(fw, fh, t.angle);
  const mx = Math.max(0, W / 2 - ex / k);
  const my = Math.max(0, H / 2 - ey / k);
  return {
    ...t,
    zoom,
    cx: Math.min(mx, Math.max(-mx, t.cx)),
    cy: Math.min(my, Math.max(-my, t.cy)),
  };
}

/** Move the image by a drag of (dx, dy) view pixels. */
export function pan(t: Transform, dx: number, dy: number, k: number): Transform {
  // Undo the view rotation so the drag is expressed along the image axes.
  const a = -rad(t.angle);
  const ix = (dx * Math.cos(a) - dy * Math.sin(a)) / k;
  const iy = (dx * Math.sin(a) + dy * Math.cos(a)) / k;
  return { ...t, cx: t.cx - ix, cy: t.cy - iy };
}

/**
 * Zoom by `factor` while keeping the image point under view offset (px, py) — measured from the
 * frame centre — fixed on screen. `k` is the scale before zooming.
 */
export function zoomAt(t: Transform, factor: number, px: number, py: number, k: number): Transform {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, t.zoom * factor));
  const real = zoom / t.zoom;
  if (real === 1) return t;
  // The anchor stays put when the centre moves by (1 − 1/real) of the anchor's image offset.
  const moved = pan(t, px, py, k);
  const ox = moved.cx - t.cx;
  const oy = moved.cy - t.cy;
  return { ...t, zoom, cx: t.cx - ox * (1 - 1 / real), cy: t.cy - oy * (1 - 1 / real) };
}

/**
 * Apply the full natural → view mapping to a 2D context whose origin is at the frame centre.
 * Afterwards draw the image at (−nw/2, −nh/2, nw, nh).
 */
export function applyToContext(ctx: CanvasRenderingContext2D, t: Transform, k: number) {
  ctx.scale(k, k);
  ctx.rotate(rad(t.angle));
  ctx.translate(-t.cx, -t.cy);
  ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.rotate((t.quarter * Math.PI) / 2);
}

/** Fit a box of the given aspect (w/h) inside maxW × maxH. */
export function fitAspect(aspect: number, maxW: number, maxH: number) {
  return maxW / maxH > aspect ? { w: maxH * aspect, h: maxH } : { w: maxW, h: maxW / aspect };
}

/** Size of the exported image: the crop at full resolution, capped on its long edge. */
export function outputSize(fw: number, fh: number, k: number, maxEdge = 2400) {
  const w = fw / k;
  const h = fh / k;
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}
