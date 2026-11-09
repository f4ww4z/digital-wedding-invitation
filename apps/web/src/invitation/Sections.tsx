import type { InvitationContent, PublicGuest } from '@sakinah/shared';
import { Hero } from './sections/Hero';
import { Opening } from './sections/Opening';
import { Couple } from './sections/Couple';
import { Countdown } from './sections/Countdown';
import { Events } from './sections/Events';
import { Story } from './sections/Story';
import { Gallery } from './sections/Gallery';
import { Etiquette, Livestream } from './sections/Extras';
import { Gift } from './sections/Gift';
import { Rsvp } from './sections/Rsvp';
import { Wishes } from './sections/Wishes';
import { Closing } from './sections/Closing';

export default function Sections({
  c,
  guestCode,
  guest,
  guestName,
}: {
  c: InvitationContent;
  guestCode: string | null;
  guest: PublicGuest | null;
  guestName: string;
}) {
  return (
    <main>
      <Hero c={c} />
      <Opening c={c} />
      <Couple c={c} />
      {c.countdown.enabled && <Countdown c={c} />}
      <Events c={c} />
      {c.story.enabled && c.story.items.length > 0 && <Story c={c} />}
      {c.gallery.enabled && c.gallery.images.length > 0 && <Gallery c={c} />}
      {c.livestream.enabled && <Livestream c={c} />}
      {c.etiquette.enabled && c.etiquette.items.length > 0 && <Etiquette c={c} />}
      {c.gift.enabled && <Gift c={c} guestCode={guestCode} guestName={guestName} />}
      {c.rsvp.enabled && <Rsvp c={c} guestCode={guestCode} guest={guest} guestName={guestName} />}
      {c.wishes.enabled && <Wishes c={c} guestCode={guestCode} guestName={guestName} />}
      <Closing c={c} />
    </main>
  );
}
