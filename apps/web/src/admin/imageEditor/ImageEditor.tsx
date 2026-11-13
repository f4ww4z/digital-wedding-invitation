import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Check,
  Crop,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  applyMatrix,
  buildMatrix,
  isIdentity,
  noAdjust,
  PRESETS,
  toSvgValues,
  type Adjust,
} from './color';
import {
  applyToContext,
  clampTransform,
  fitAspect,
  identityTransform,
  MAX_ZOOM,
  orientedSize,
  outputSize,
  pan,
  scaleOf,
  zoomAt,
  type Transform,
} from './geometry';

export type FrameShape = 'arch' | 'circle';

export type EditOptions = {
  /** Suggested crop ratio (width / height) for where the image is used. */
  aspect?: number;
  /** Label for the suggested ratio, e.g. "Portrait 3:4". */
  aspectLabel?: string;
  /** Outline drawn inside the crop so the couple can see how the photo is framed on the invitation. */
  shape?: FrameShape;
  /** Position in a multi-photo upload. */
  queue?: { index: number; total: number };
};

type Tab = 'crop' | 'rotate' | 'adjust' | 'filters';
type AspectChoice = {
  id: string;
  label?: string;
  labelKey?: string;
  value: number | 'original' | 'free';
  recommended?: boolean;
};

const BASE_ASPECTS: AspectChoice[] = [
  { id: 'original', labelKey: 'aspect.original', value: 'original' },
  { id: 'free', labelKey: 'aspect.free', value: 'free' },
  { id: '1:1', labelKey: 'aspect.square', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '9:16', label: '9:16', value: 9 / 16 },
];

const ADJUSTMENTS: (keyof Adjust)[] = ['brightness', 'contrast', 'saturation', 'warmth'];

const PREVIEW_MAX = 1600;
const STAGE_PAD = 20;
const MIN_FREE = 0.15;

function aspectChoices(opts: EditOptions): AspectChoice[] {
  if (!opts.aspect) return BASE_ASPECTS;
  const match = BASE_ASPECTS.find(
    (a) => typeof a.value === 'number' && Math.abs(a.value - opts.aspect!) < 0.01,
  );
  if (match) return BASE_ASPECTS.map((a) => (a === match ? { ...a, recommended: true } : a));
  return [
    {
      id: 'suggested',
      ...(opts.aspectLabel ? { label: opts.aspectLabel } : { labelKey: 'aspect.suggested' }),
      value: opts.aspect,
      recommended: true,
    },
    ...BASE_ASPECTS,
  ];
}

/** Downscaled copy of the image for a fast live preview (the export always uses the full image). */
function makePreviewSource(img: HTMLImageElement): CanvasImageSource {
  const s = Math.min(1, PREVIEW_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  if (s === 1) return img;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function thumbnailUrl(img: HTMLImageElement) {
  const size = 120;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext('2d')!.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return c.toDataURL('image/jpeg', 0.8);
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, type, q));

async function exportImage(
  img: HTMLImageElement,
  t: Transform,
  fw: number,
  fh: number,
  k: number,
  adjust: Adjust,
  preset: string,
  strength: number,
  sourceType: string,
) {
  const { w, h } = outputSize(fw, fh, k);
  const ko = (k * w) / fw;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const opaque = !/png|webp|avif|gif/.test(sourceType);
  if (opaque) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(w / 2, h / 2);
  applyToContext(ctx, t, ko);
  ctx.drawImage(
    img,
    -img.naturalWidth / 2,
    -img.naturalHeight / 2,
    img.naturalWidth,
    img.naturalHeight,
  );
  ctx.restore();
  const m = buildMatrix(adjust, preset, strength);
  if (!isIdentity(m)) {
    const data = ctx.getImageData(0, 0, w, h);
    applyMatrix(data.data, m);
    ctx.putImageData(data, 0, 0);
  }
  // The server re-encodes to WebP anyway, so send something lossless-ish and compact.
  const webp = await toBlob(canvas, 'image/webp', 0.95);
  if (webp?.type === 'image/webp') return webp;
  return (
    (opaque ? await toBlob(canvas, 'image/jpeg', 0.95) : await toBlob(canvas, 'image/png')) ?? webp!
  );
}

export function ImageEditor({
  img,
  file,
  options,
  onDone,
  onCancel,
}: {
  img: HTMLImageElement;
  file: File;
  options: EditOptions;
  onDone: (f: File) => void;
  onCancel: () => void;
}) {
  const { t: tr } = useTranslation('editor');
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const filterId = useId().replace(/:/g, '');
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const previewSource = useMemo(() => makePreviewSource(img), [img]);
  const thumb = useMemo(() => thumbnailUrl(img), [img]);

  const choices = useMemo(() => aspectChoices(options), [options]);
  const initialAspect =
    choices.find((c) => c.recommended) ?? choices.find((c) => c.id === 'original')!;

  const [tab, setTab] = useState<Tab>('crop');
  const [aspectId, setAspectId] = useState(initialAspect.id);
  const [free, setFree] = useState({ w: 1, h: 1 });
  const [t, setT] = useState<Transform>(identityTransform);
  const [adjust, setAdjust] = useState<Adjust>(noAdjust);
  const [preset, setPreset] = useState('none');
  const [strength, setStrength] = useState(1);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState(false);
  const [touched, setTouched] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // Stop the page behind from scrolling (and showing its scrollbar) while editing.
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setStageSize({ w: e!.contentRect.width, h: e!.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ----- Frame geometry -----
  const { W, H } = orientedSize(nw, nh, t.quarter);
  const availW = Math.max(40, stageSize.w - STAGE_PAD * 2);
  const availH = Math.max(40, stageSize.h - STAGE_PAD * 2);
  const choice = choices.find((c) => c.id === aspectId) ?? initialAspect;
  const frame =
    choice.value === 'free'
      ? { w: free.w * availW, h: free.h * availH }
      : fitAspect(choice.value === 'original' ? W / H : choice.value, availW, availH);
  const ct = clampTransform(t, W, H, frame.w, frame.h);
  const k = scaleOf(ct, W, H, frame.w, frame.h);
  const geo = useRef({ W, H, fw: frame.w, fh: frame.h });
  geo.current = { W, H, fw: frame.w, fh: frame.h };

  /** Update the transform, always keeping the frame covered. */
  const update = useCallback((fn: (t: Transform, k: number) => Transform) => {
    setT((prev) => {
      const g = geo.current;
      const c = clampTransform(prev, g.W, g.H, g.fw, g.fh);
      return clampTransform(fn(c, scaleOf(c, g.W, g.H, g.fw, g.fh)), g.W, g.H, g.fw, g.fh);
    });
  }, []);

  // ----- Live preview -----
  useEffect(() => {
    const c = canvas.current;
    if (!c || !stageSize.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(stageSize.w * dpr);
    c.height = Math.round(stageSize.h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, stageSize.w, stageSize.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(stageSize.w / 2, stageSize.h / 2);
    applyToContext(ctx, ct, k);
    ctx.drawImage(previewSource, -nw / 2, -nh / 2, nw, nh);
  }, [ct, k, stageSize, previewSource, nw, nh]);

  const matrix = useMemo(() => buildMatrix(adjust, preset, strength), [adjust, preset, strength]);
  const showFilter = !comparing && !isIdentity(matrix);

  // ----- Pointer: drag to pan, pinch to zoom -----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);

  const centreOffset = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
      mx: (a!.x + b!.x) / 2,
      my: (a!.y + b!.y) / 2,
    };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = pinchState();
    setActive(true);
    setTouched(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      update((t, k) => pan(t, dx, dy, k));
    } else if (pointers.current.size === 2 && pinch.current) {
      const now = pinchState();
      const before = pinch.current;
      pinch.current = now;
      const o = centreOffset(now.mx, now.my);
      update((t, k) => {
        const z = zoomAt(t, now.dist / before.dist, o.x, o.y, k);
        return pan(z, now.mx - before.mx, now.my - before.my, k * (z.zoom / t.zoom));
      });
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = pointers.current.size === 2 ? pinchState() : null;
    if (pointers.current.size === 0) setActive(false);
  };

  // Wheel / trackpad zoom (needs a non-passive listener to stop the page from scrolling).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let idle: number | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const o = centreOffset(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      update((t, k) => zoomAt(t, factor, o.x, o.y, k));
      setTouched(true);
      setActive(true);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setActive(false), 400);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(idle);
    };
  }, [update]);

  const onStageKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      update((t, k) => pan(t, dx, dy, k));
    } else if (e.key === '+' || e.key === '=') {
      update((t, k) => zoomAt(t, 1.1, 0, 0, k));
    } else if (e.key === '-') {
      update((t, k) => zoomAt(t, 1 / 1.1, 0, 0, k));
    }
  };

  // ----- Free-crop corner handles (resize symmetrically around the centre) -----
  const resizeFrom = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    const kBefore = k;
    const move = (ev: PointerEvent) => {
      const o = centreOffset(ev.clientX, ev.clientY);
      const fw = Math.min(1, Math.max(MIN_FREE, (Math.abs(o.x) * 2) / availW));
      const fh = Math.min(1, Math.max(MIN_FREE, (Math.abs(o.y) * 2) / availH));
      setFree({ w: fw, h: fh });
      // Keep the image the same size on screen while the frame changes.
      setT((prev) => {
        const kMinNew = scaleOf({ ...prev, zoom: 1 }, W, H, fw * availW, fh * availH);
        return { ...prev, zoom: Math.max(1, kBefore / kMinNew) };
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setActive(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const chooseAspect = (id: string) => {
    if (id === 'free' && aspectId !== 'free') setFree({ w: frame.w / availW, h: frame.h / availH });
    setAspectId(id);
  };

  // ----- Rotate & flip -----
  const rotate = (dir: 1 | -1) =>
    update((t) => {
      // Flipping mirrors the turn direction, so turn the other way to keep it visually correct.
      const d = t.flipX !== t.flipY ? -dir : dir;
      const cx = dir === 1 ? -t.cy : t.cy;
      const cy = dir === 1 ? t.cx : -t.cx;
      return { ...t, quarter: (t.quarter + d + 4) % 4, cx, cy };
    });
  const flip = (axis: 'x' | 'y') =>
    update((t) =>
      axis === 'x'
        ? { ...t, flipX: !t.flipX, cx: -t.cx, angle: -t.angle }
        : { ...t, flipY: !t.flipY, cy: -t.cy, angle: -t.angle },
    );

  const resetAll = () => {
    setT(identityTransform());
    setAdjust(noAdjust());
    setPreset('none');
    setStrength(1);
    setAspectId(initialAspect.id);
    setFree({ w: 1, h: 1 });
  };

  const dirty =
    JSON.stringify(t) !== JSON.stringify(identityTransform()) ||
    !isIdentity(matrix) ||
    aspectId !== initialAspect.id ||
    (aspectId === 'free' && (free.w !== 1 || free.h !== 1));

  const save = async () => {
    setSaving(true);
    try {
      const blob = await exportImage(
        img,
        ct,
        frame.w,
        frame.h,
        k,
        adjust,
        preset,
        strength,
        file.type,
      );
      const ext = blob.type.split('/')[1] === 'jpeg' ? 'jpg' : blob.type.split('/')[1];
      const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
      onDone(new File([blob], `${base}.${ext}`, { type: blob.type }));
    } finally {
      setSaving(false);
    }
  };

  const zoomSlider = Math.round((Math.log(ct.zoom) / Math.log(MAX_ZOOM)) * 100);
  const title =
    options.queue && options.queue.total > 1
      ? tr('titleQueue', { n: options.queue.index, total: options.queue.total })
      : tr('title');
  const frameLeft = (stageSize.w - frame.w) / 2;
  const frameTop = (stageSize.h - frame.h) / 2;

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-surface p-0 text-ink backdrop:bg-black/60 sm:m-auto sm:h-[min(50rem,94dvh)] sm:w-[min(64rem,96vw)] sm:rounded-2xl sm:shadow-2xl"
    >
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={toSvgValues(matrix)} />
        </filter>
        {PRESETS.map((p) => (
          <filter key={p.id} id={`${filterId}-${p.id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={toSvgValues(buildMatrix(noAdjust(), p.id))} />
          </filter>
        ))}
      </svg>

      <div className="flex h-full flex-col lg:grid lg:grid-cols-[1fr_21rem] lg:grid-rows-[auto_1fr_auto]">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 lg:col-span-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-muted hover:bg-line"
            aria-label={tr('cancelEditing')}
          >
            <X size={20} aria-hidden />
          </button>
          <h2 className="mr-auto text-base font-semibold">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-1.5 text-sm"
            onClick={resetAll}
            disabled={!dirty}
          >
            <Undo2 size={16} aria-hidden /> {tr('reset')}
          </button>
        </div>

        {/* Stage */}
        <div className="flex min-h-0 flex-1 flex-col bg-[#1c1820] lg:row-span-2">
          <div
            ref={stage}
            tabIndex={0}
            role="application"
            aria-label={tr('cropArea')}
            onKeyDown={onStageKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative min-h-[16rem] flex-1 cursor-grab touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary active:cursor-grabbing"
          >
            <canvas
              ref={canvas}
              data-testid="editor-preview"
              className="absolute inset-0 h-full w-full"
              style={{ filter: showFilter ? `url(#${filterId})` : undefined }}
            />
            {stageSize.w > 0 && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: frameLeft,
                  top: frameTop,
                  width: frame.w,
                  height: frame.h,
                  boxShadow: '0 0 0 100vmax rgb(20 16 24 / 0.62)',
                }}
                data-testid="crop-frame"
              >
                <div className="absolute inset-0 outline outline-2 outline-white/90" />
                {/* Rule-of-thirds grid while moving */}
                <div
                  className={`absolute inset-0 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden
                >
                  {[1, 2].map((i) => (
                    <div
                      key={`v${i}`}
                      className="absolute inset-y-0 w-px bg-white/45"
                      style={{ left: `${(i * 100) / 3}%` }}
                    />
                  ))}
                  {[1, 2].map((i) => (
                    <div
                      key={`h${i}`}
                      className="absolute inset-x-0 h-px bg-white/45"
                      style={{ top: `${(i * 100) / 3}%` }}
                    />
                  ))}
                </div>
                {options.shape && (
                  <div
                    aria-hidden
                    className="absolute inset-[3%] border-2 border-dashed border-white/80"
                    style={
                      {
                        borderRadius: options.shape === 'circle' ? '50%' : '999px 999px 14px 14px',
                      } as CSSProperties
                    }
                  />
                )}
                {/* Corner marks; draggable in Free mode */}
                {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                  <span
                    key={c}
                    onPointerDown={choice.value === 'free' ? resizeFrom : undefined}
                    aria-hidden
                    className={`absolute h-6 w-6 border-white ${c.includes('t') ? '-top-1 border-t-4' : '-bottom-1 border-b-4'} ${c.includes('l') ? '-left-1 border-l-4' : '-right-1 border-r-4'} ${choice.value === 'free' ? 'pointer-events-auto cursor-nwse-resize touch-none' : ''}`}
                    style={
                      choice.value === 'free' && (c === 'tr' || c === 'bl')
                        ? { cursor: 'nesw-resize' }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
            {!touched && (
              <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-max rounded-full bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur">
                {tr('hintDrag')}
              </p>
            )}
            {options.shape && touched && (
              <p className="pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto w-max rounded-full bg-black/50 px-2.5 py-1 text-[0.65rem] text-white/90">
                {tr('hintFrame')}
              </p>
            )}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-3 px-4 py-3 text-white/85">
            <button
              type="button"
              className="rounded-full p-1.5 hover:bg-white/10"
              aria-label={tr('zoomOut')}
              onClick={() => update((t, k) => zoomAt(t, 1 / 1.25, 0, 0, k))}
            >
              <ZoomOut size={18} aria-hidden />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={zoomSlider}
              aria-label={tr('zoom')}
              onChange={(e) => {
                const z = Math.pow(MAX_ZOOM, Number(e.target.value) / 100);
                update((t) => ({ ...t, zoom: z }));
                setTouched(true);
              }}
              className="flex-1 accent-white"
            />
            <button
              type="button"
              className="rounded-full p-1.5 hover:bg-white/10"
              aria-label={tr('zoomIn')}
              onClick={() => update((t, k) => zoomAt(t, 1.25, 0, 0, k))}
            >
              <ZoomIn size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
              disabled={isIdentity(matrix)}
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setComparing(true)}
              onKeyUp={() => setComparing(false)}
              title={tr('compareTitle')}
            >
              <Eye size={14} aria-hidden /> {tr('compare')}
            </button>
          </div>
        </div>

        {/* Tools */}
        <div className="flex min-h-0 flex-col lg:border-l lg:border-line">
          <div
            role="tablist"
            aria-label={tr('tools')}
            className="grid grid-cols-4 gap-1 border-b border-line p-1.5"
          >
            {(
              [
                ['crop', 'tabs.crop', Crop],
                ['rotate', 'tabs.rotate', RotateCw],
                ['adjust', 'tabs.adjust', SlidersHorizontal],
                ['filters', 'tabs.filters', Sparkles],
              ] as const
            ).map(([id, labelKey, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors ${tab === id ? 'bg-primary-soft font-medium text-ink' : 'text-muted hover:bg-line/60'}`}
              >
                <Icon size={18} aria-hidden />
                {tr(labelKey)}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            className="max-h-[30dvh] overflow-y-auto px-4 pb-4 pt-3 lg:max-h-none lg:flex-1"
          >
            {tab === 'crop' && (
              <>
                <p className="mb-3 text-xs text-muted">
                  {tr('cropHint')}
                  {choice.value === 'free' ? tr('cropHintFree') : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={aspectId === c.id}
                      onClick={() => chooseAspect(c.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${aspectId === c.id ? 'border-primary-strong bg-primary-strong text-white' : 'border-line hover:bg-primary-soft'}`}
                    >
                      {typeof c.value === 'number' && <AspectIcon ratio={c.value} />}
                      {c.label ?? tr(c.labelKey!)}
                      {c.recommended && (
                        <span
                          className={`text-[0.65rem] ${aspectId === c.id ? 'text-white/80' : 'text-primary-strong'}`}
                        >
                          {tr('bestFit')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === 'rotate' && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <ToolButton
                    label={tr('left')}
                    onClick={() => rotate(-1)}
                    icon={<RotateCcw size={20} aria-hidden />}
                    aria={tr('rotateLeft')}
                  />
                  <ToolButton
                    label={tr('right')}
                    onClick={() => rotate(1)}
                    icon={<RotateCw size={20} aria-hidden />}
                    aria={tr('rotateRight')}
                  />
                  <ToolButton
                    label={tr('mirror')}
                    onClick={() => flip('x')}
                    icon={<FlipHorizontal2 size={20} aria-hidden />}
                    aria={tr('flipH')}
                    pressed={ct.flipX}
                  />
                  <ToolButton
                    label={tr('flip')}
                    onClick={() => flip('y')}
                    icon={<FlipVertical2 size={20} aria-hidden />}
                    aria={tr('flipV')}
                    pressed={ct.flipY}
                  />
                </div>
                <Slider
                  label={tr('straighten')}
                  min={-45}
                  max={45}
                  step={0.5}
                  value={ct.angle}
                  format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°`}
                  onChange={(v) => update((t) => ({ ...t, angle: Math.abs(v) < 0.75 ? 0 : v }))}
                  onActive={setActive}
                />
              </>
            )}

            {tab === 'adjust' && (
              <div className="flex flex-col gap-1">
                {ADJUSTMENTS.map((a) => (
                  <Slider
                    key={a}
                    label={tr(`adjustments.${a}`)}
                    min={-100}
                    max={100}
                    step={1}
                    value={adjust[a]}
                    format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
                    onChange={(v) => setAdjust((x) => ({ ...x, [a]: Math.abs(v) < 3 ? 0 : v }))}
                  />
                ))}
              </div>
            )}

            {tab === 'filters' && (
              <>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={preset === p.id}
                      onClick={() => setPreset(p.id)}
                      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 text-xs lg:w-auto"
                    >
                      <img
                        src={thumb}
                        alt=""
                        className={`aspect-square w-full rounded-xl object-cover ring-offset-2 ring-offset-surface ${preset === p.id ? 'ring-2 ring-primary-strong' : ''}`}
                        style={{
                          filter: p.id === 'none' ? undefined : `url(#${filterId}-${p.id})`,
                        }}
                      />
                      <span className={preset === p.id ? 'font-medium' : 'text-muted'}>
                        {tr(`presets.${p.id}`)}
                      </span>
                    </button>
                  ))}
                </div>
                {preset !== 'none' && (
                  <Slider
                    label={tr('strength')}
                    min={0}
                    max={100}
                    step={1}
                    value={strength * 100}
                    format={(v) => `${Math.round(v)}%`}
                    onChange={(v) => setStrength(v / 100)}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto flex gap-2 border-t border-line p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <button
              type="button"
              className="btn btn-ghost flex-1 !px-3 text-sm"
              onClick={() => onDone(file)}
              disabled={saving}
            >
              {tr('useOriginal')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-[1.4] !px-3 text-sm"
              onClick={() => void save()}
              disabled={saving}
            >
              <Check size={18} aria-hidden /> {saving ? tr('saving') : tr('save')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function AspectIcon({ ratio }: { ratio: number }) {
  const w = ratio >= 1 ? 14 : 14 * ratio;
  const h = ratio >= 1 ? 14 / ratio : 14;
  return (
    <span
      aria-hidden
      className="inline-block rounded-[2px] border-[1.5px] border-current"
      style={{ width: w, height: h }}
    />
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  aria,
  pressed,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  aria: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-pressed={pressed}
      className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs transition-colors ${pressed ? 'border-primary-strong bg-primary-soft' : 'border-line hover:bg-primary-soft'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  onActive,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onActive?: (on: boolean) => void;
}) {
  const { t: tr } = useTranslation('editor');
  const id = useId();
  const zero = min < 0 ? 0 : min;
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-0.5 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-muted">{format(value)}</span>
          {value !== zero && min < 0 && (
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-xs text-primary-strong hover:bg-primary-soft"
              onClick={() => onChange(0)}
              aria-label={tr('resetNamed', { label })}
            >
              {tr('reset')}
            </button>
          )}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => onActive?.(true)}
        onPointerUp={() => onActive?.(false)}
        onDoubleClick={() => min < 0 && onChange(0)}
        className="w-full accent-[var(--c-primary-strong)]"
      />
    </div>
  );
}
