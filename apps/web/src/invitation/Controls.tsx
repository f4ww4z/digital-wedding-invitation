import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Languages, Music2, Pause } from 'lucide-react';
import type { InvitationContent } from '@sakinah/shared';
import { setLocale } from '../lib/i18n';

export function useMusic(c: InvitationContent) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const enabled = c.music.enabled && !!c.music.src;

  useEffect(() => {
    if (!enabled) return;
    const a = new Audio(c.music.src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0.6;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    a.addEventListener('play', on);
    a.addEventListener('pause', off);
    audio.current = a;
    // Pause when the tab is hidden; guests switching to WhatsApp shouldn't keep hearing it.
    const vis = () => {
      if (document.hidden) a.pause();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      a.pause();
      a.removeEventListener('play', on);
      a.removeEventListener('pause', off);
      document.removeEventListener('visibilitychange', vis);
      audio.current = null;
    };
  }, [enabled, c.music.src]);

  return {
    enabled,
    playing,
    play: () => void audio.current?.play().catch(() => undefined),
    toggle: () => {
      const a = audio.current;
      if (!a) return;
      if (a.paused) void a.play().catch(() => undefined);
      else a.pause();
    },
  };
}

export function Controls({ music }: { music: ReturnType<typeof useMusic> }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'en' ? 'id' : 'en';
  return (
    <div className="fixed bottom-5 right-4 z-30 flex flex-col gap-3 [padding-bottom:env(safe-area-inset-bottom)] sm:right-[calc(50%-14rem)]">
      <button
        type="button"
        onClick={() => setLocale(next)}
        className="glass flex h-12 w-12 items-center justify-center rounded-full text-ink"
        aria-label={`${t('language')}: ${t('switchTo')}`}
        title={t('switchTo')}
      >
        <Languages size={18} aria-hidden />
        <span className="sr-only">{t('switchTo')}</span>
      </button>
      {music.enabled && (
        <button
          type="button"
          onClick={music.toggle}
          className="glass relative flex h-12 w-12 items-center justify-center rounded-full text-primary-strong"
          aria-label={music.playing ? t('pauseMusic') : t('openingMusic')}
          aria-pressed={music.playing}
        >
          <motion.span
            aria-hidden
            className="absolute inset-1 rounded-full border border-dashed border-[color-mix(in_oklab,var(--c-primary)_50%,transparent)]"
            animate={music.playing ? { rotate: 360 } : { rotate: 0 }}
            transition={music.playing ? { repeat: Infinity, duration: 8, ease: 'linear' } : { duration: 0.3 }}
          />
          {music.playing ? <Pause size={18} aria-hidden /> : <Music2 size={18} aria-hidden />}
        </button>
      )}
    </div>
  );
}
