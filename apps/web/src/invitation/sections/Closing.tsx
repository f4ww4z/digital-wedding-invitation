import type { InvitationContent } from '@wedding/shared';
import { useL } from '../../lib/i18n';
import { Depth, Reveal, Section } from '../motion';
import { CornerCluster, FloralDivider } from '../ornaments/Florals';

export function Closing({ c }: { c: InvitationContent }) {
  const { l } = useL();
  const [a, b] = c.couple.order === 'bride-first' ? [c.couple.bride, c.couple.groom] : [c.couple.groom, c.couple.bride];
  return (
    <Section
      id="closing"
      className="!pb-56 text-center"
      decor={
        <>
          <Depth depth={0.5} className="absolute -bottom-4 -left-6 rotate-180 [&>*]:-scale-x-100">
            <CornerCluster scale={0.8} />
          </Depth>
          <Depth depth={0.6} className="absolute -bottom-4 -right-6 rotate-180">
            <CornerCluster scale={0.9} />
          </Depth>
        </>
      }
    >
      {c.closing.image && <img src={c.closing.image} alt="" loading="lazy" className="arch mx-auto mb-10 h-72 w-56 object-cover" />}
      <Reveal>
        <p className="mx-auto max-w-[22rem] text-[1rem] text-ink/85">{l(c.closing.text)}</p>
        <FloralDivider className="my-10" />
        <p className="text-sm text-muted">{l(c.closing.signature)}</p>
        <p className="display-italic mt-3 text-[3rem] leading-tight">
          {a.nickname} <span className="text-primary">&amp;</span> {b.nickname}
        </p>
      </Reveal>
    </Section>
  );
}
