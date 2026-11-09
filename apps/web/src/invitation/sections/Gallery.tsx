import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { InvitationContent } from '@sakinah/shared';
import { Section, SectionTitle } from '../motion';

export function Gallery({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  const imgs = c.gallery.images;
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? null : (i + d + imgs.length) % imgs.length)), [imgs.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  return (
    <Section id="gallery">
      <SectionTitle>{t('gallery')}</SectionTitle>
      <div className="columns-2 gap-3 [&>*]:mb-3">
        {imgs.map((img, i) => (
          <motion.button
            key={img.src + i}
            type="button"
            className="block w-full overflow-hidden rounded-2xl"
            onClick={() => setOpen(i)}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5% 0px' }}
            transition={{ duration: 0.7, delay: (i % 2) * 0.12 }}
            aria-label={img.alt || `${t('gallery')} ${i + 1}`}
          >
            <img src={img.src} alt={img.alt} loading="lazy" decoding="async" className="w-full transition-transform duration-700 hover:scale-105" />
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && imgs[open] && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(25_18_30/0.92)]"
            role="dialog"
            aria-modal="true"
            aria-label={t('gallery')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.img
              key={open}
              src={imgs[open].src}
              alt={imgs[open].alt}
              className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white" onClick={() => setOpen(null)} aria-label={t('close')}>
              <X aria-hidden />
            </button>
            {imgs.length > 1 && (
              <>
                <button type="button" className="absolute left-3 rounded-full bg-white/10 p-3 text-white" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={t('prev')}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" className="absolute right-3 rounded-full bg-white/10 p-3 text-white" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={t('next')}>
                  <ChevronRight aria-hidden />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
