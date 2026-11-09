import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useTranslation } from 'react-i18next';
import Lenis from 'lenis';
import { api } from '../lib/api';
import { applyTheme, readGuestParams, useContent, useGuest } from '../lib/content';
import { hasStoredLocale, setLocale, useL } from '../lib/i18n';
import { shortDate } from '../lib/format';
import { Cover } from './Cover';
import { Controls, useMusic } from './Controls';
import { requestMotionPermission, TiltProvider } from './motion';
import { Bloom, CornerCluster } from './ornaments/Florals';

/** Wide screens: the phone column floats over a soft, blurred garden. */
function DesktopBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden sm:block">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 15% 20%, var(--c-primary-soft), transparent 70%), radial-gradient(60% 60% at 85% 80%, var(--c-accent-soft), transparent 70%), var(--c-bg)' }} />
      <div className="absolute -left-16 -top-10 opacity-60 blur-[3px]">
        <CornerCluster scale={2.2} />
      </div>
      <div className="absolute -bottom-24 -right-16 rotate-180 opacity-50 blur-[4px]">
        <CornerCluster scale={2.4} />
      </div>
    </div>
  );
}

const CoverScene = lazy(() => import('../three/CoverScene'));
// Everything behind the cover is a separate chunk, prefetched while the cover is shown.
const loadSections = () => import('./Sections');
const Sections = lazy(loadSections);

/** WebGL is worth it only on capable devices that haven't asked for less motion. */
function canUse3D(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 3) return false;
  try {
    const cv = document.createElement('canvas');
    return !!(cv.getContext('webgl2') || cv.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Invitation() {
  const { t } = useTranslation();
  const { l } = useL();
  const content = useContent();
  const [{ code, toName }] = useState(readGuestParams);
  const guest = useGuest(code);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [use3D] = useState(canUse3D);
  const c = content.data;
  const music = useMusic(
    c ?? ({ music: { enabled: false, src: '', title: '' } } as unknown as Parameters<typeof useMusic>[0]),
  );

  useEffect(() => {
    void loadSections();
  }, []);

  useEffect(() => {
    if (!c) return;
    applyTheme(c.theme);
    document.title = c.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', c.meta.description);
    if (!hasStoredLocale()) setLocale(c.defaultLocale);
  }, [c]);

  // Lock scroll until the cover is opened.
  useEffect(() => {
    document.body.classList.toggle('scroll-locked', !opened);
    if (!opened) window.scrollTo(0, 0);
    return () => document.body.classList.remove('scroll-locked');
  }, [opened]);

  // Smooth wheel scrolling on desktop; touch keeps native momentum.
  useEffect(() => {
    if (!opened || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [opened]);

  if (content.isError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <Bloom size={64} />
        <p>{t('somethingWrong')}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('retry')}
        </button>
      </main>
    );
  }
  if (!c) {
    return (
      <main className="flex min-h-svh items-center justify-center" aria-busy="true">
        <div className="animate-pulse">
          <Bloom size={56} />
        </div>
      </main>
    );
  }

  const guestName = guest.data?.name ?? toName ?? l(c.cover.defaultGuest);
  const guestCode = guest.data ? code : null;

  const open = () => {
    if (opening) return;
    setOpening(true);
    music.play();
    void requestMotionPermission();
    void api('/api/open', { method: 'POST', json: guestCode ? { guestCode } : {} }).catch(() => undefined);
    setTimeout(() => setOpened(true), use3D ? 1500 : 1000);
  };

  return (
    <MotionConfig reducedMotion="user">
      <TiltProvider enabled>
        <DesktopBackdrop />
        <div className="relative mx-auto min-h-svh max-w-[30rem] overflow-x-clip bg-bg shadow-[0_0_80px_-20px_rgb(61_51_69/0.25)]">
          <AnimatePresence>
            {!opened && (
              <Cover
                key="cover"
                c={c}
                guestName={guestName}
                onOpen={open}
                opening={opening}
                backdrop={
                  use3D ? (
                    <Suspense fallback={null}>
                      <CoverScene
                        opening={opening}
                        title={c.couple.order === 'bride-first' ? `${c.couple.bride.nickname} & ${c.couple.groom.nickname}` : `${c.couple.groom.nickname} & ${c.couple.bride.nickname}`}
                        subtitle={c.events[0] ? shortDate(c.events[0]) : ''}
                      />
                    </Suspense>
                  ) : undefined
                }
              />
            )}
          </AnimatePresence>

          {opened && (
            <Suspense fallback={<div className="min-h-svh" />}>
              <Sections c={c} guestCode={guestCode} guest={guest.data ?? null} guestName={guest.data?.name ?? toName ?? ''} />
            </Suspense>
          )}
          {opened && <Controls music={music} />}
        </div>
      </TiltProvider>
    </MotionConfig>
  );
}
