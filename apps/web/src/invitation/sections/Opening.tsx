import type { InvitationContent } from '@sakinah/shared';
import { useL } from '../../lib/i18n';
import { Depth, Reveal, Section } from '../motion';
import { FloralDivider, Leaf } from '../ornaments/Florals';

export function Opening({ c }: { c: InvitationContent }) {
  const { l } = useL();
  const o = c.opening;
  return (
    <Section
      id="opening"
      className="text-center"
      decor={
        <>
          <Depth depth={0.5} className="absolute -left-4 top-10">
            <Leaf length={90} rotate={35} tone="pale" />
          </Depth>
          <Depth depth={0.4} className="absolute -right-2 bottom-10">
            <Leaf length={80} rotate={-150} tone="sage" />
          </Depth>
        </>
      }
    >
      {o.verseEnabled && (
        <Reveal>
          <p dir="rtl" lang="ar" className="font-arabic text-[1.55rem] leading-[2.2] text-ink">
            {o.verseArabic}
          </p>
          <p className="display mt-6 text-[1.2rem] italic leading-relaxed text-ink/85">{l(o.verseText)}</p>
          <p className="mt-3 text-sm text-muted">{o.verseSource}</p>
          <FloralDivider className="my-10" />
        </Reveal>
      )}
      <Reveal delay={0.1}>
        <p className="display text-[1.5rem]">{l(o.greeting)}</p>
        <p className="mx-auto mt-4 max-w-[24rem] text-[0.98rem] text-ink/80">{l(o.intro)}</p>
      </Reveal>
    </Section>
  );
}
