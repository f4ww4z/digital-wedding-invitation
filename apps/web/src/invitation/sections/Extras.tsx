import { useTranslation } from 'react-i18next';
import { Camera, Clock, Gift, HandHeart, Phone, Shirt, ShieldPlus, Users, Utensils, Video, HeartHandshake } from 'lucide-react';
import type { InvitationContent } from '@wedding/shared';
import type { etiquetteIcons } from '@wedding/shared';
import { useL } from '../../lib/i18n';
import { Reveal, Section, SectionTitle } from '../motion';

const ICONS: Record<(typeof etiquetteIcons)[number], typeof Clock> = {
  mask: ShieldPlus,
  clock: Clock,
  dress: Shirt,
  phone: Phone,
  camera: Camera,
  gift: Gift,
  hands: HandHeart,
  utensils: Utensils,
  pray: HeartHandshake,
  users: Users,
};

export function Livestream({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  const { l } = useL();
  if (!c.livestream.url) return null;
  return (
    <Section id="livestream" className="text-center">
      <SectionTitle sub={l(c.livestream.text)}>{t('livestream')}</SectionTitle>
      <a href={c.livestream.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
        <Video size={18} aria-hidden /> {t('watchLive', { platform: c.livestream.platform || 'Live' })}
      </a>
    </Section>
  );
}

export function Etiquette({ c }: { c: InvitationContent }) {
  const { t } = useTranslation();
  const { l } = useL();
  return (
    <Section id="etiquette">
      <SectionTitle>{t('etiquette')}</SectionTitle>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8">
        {c.etiquette.items.map((it, i) => {
          const Icon = ICONS[it.icon];
          return (
            <li key={i}>
              <Reveal delay={i * 0.06} className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon size={24} strokeWidth={1.5} aria-hidden />
                </span>
                <span className="mt-3 text-sm text-ink/85">{l(it.text)}</span>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
