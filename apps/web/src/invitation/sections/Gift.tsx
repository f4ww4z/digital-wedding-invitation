import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { CheckCircle2, ExternalLink, Gift as GiftIcon, Landmark, MapPin, QrCode, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { InvitationContent, PublicWishlistItem } from '@sakinah/shared';
import { api, errorMessage } from '../../lib/api';
import { clientToken, rememberName } from '../../lib/clientToken';
import { useL } from '../../lib/i18n';
import { Depth, Reveal, Section, SectionTitle } from '../motion';
import { Bloom } from '../ornaments/Florals';
import { CopyButton, Modal, SegmentedChoice } from '../ui';

type Method = 'transfer' | 'ewallet' | 'physical' | 'other';

function ConfirmForm({ guestCode, defaultName }: { guestCode: string | null; defaultName: string }) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName || rememberName());
  const [method, setMethod] = useState<Method>('transfer');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [hp, setHp] = useState('');
  const [done, setDone] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      api('/api/gifts/confirm', {
        method: 'POST',
        json: {
          guestCode: guestCode ?? undefined,
          name,
          method,
          amount: amount ? Number(amount.replace(/\D/g, '')) : undefined,
          target,
          note,
          website: hp,
        },
      }),
    onSuccess: () => {
      rememberName(name);
      setDone(true);
      toast.success(t('giftConfirmed'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (done)
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-center text-accent">
        <CheckCircle2 aria-hidden /> {t('giftConfirmed')}
      </p>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-left">
      <p className="text-sm text-muted">{t('confirmGiftHint')}</p>
      <label className="text-sm">
        {t('yourName')}
        <input className="field mt-1" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <div className="text-sm">
        <span>{t('giftMethod')}</span>
        <div className="mt-1">
          <SegmentedChoice<Method>
            name={t('giftMethod')}
            value={method}
            onChange={setMethod}
            options={(['transfer', 'ewallet', 'physical'] as const).map((v) => ({ value: v, label: t(`method_${v}`) }))}
          />
        </div>
      </div>
      {method !== 'physical' && (
        <label className="text-sm">
          {t('amountOptional')}
          <input className="field mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="500.000" />
        </label>
      )}
      <label className="text-sm">
        {t('giftTarget')}
        <input className="field mt-1" maxLength={120} value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="text-sm">
        {t('noteOptional')}
        <textarea className="field mt-1" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {/* Honeypot: hidden from people, irresistible to bots */}
      <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
      <button className="btn btn-primary mt-2" disabled={m.isPending || !name.trim()}>
        {t('sendConfirmation')}
      </button>
    </form>
  );
}

function Wishlist({ guestCode, defaultName }: { guestCode: string | null; defaultName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const token = clientToken();
  const q = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api<PublicWishlistItem[]>(`/api/wishlist?token=${encodeURIComponent(token)}`),
  });
  const [asking, setAsking] = useState<PublicWishlistItem | null>(null);
  const [name, setName] = useState(defaultName || rememberName());
  const claim = useMutation({
    mutationFn: (id: number) => api(`/api/wishlist/${id}/claim`, { method: 'POST', json: { guestCode: guestCode ?? undefined, name, clientToken: token } }),
    onSuccess: () => {
      rememberName(name);
      setAsking(null);
      toast.success(t('claimedToast'));
      void qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
  const unclaim = useMutation({
    mutationFn: (id: number) => api(`/api/wishlist/${id}/unclaim`, { method: 'POST', json: { clientToken: token } }),
    onSuccess: () => {
      toast(t('unclaimedToast'));
      void qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!q.data?.length) return null;
  return (
    <div className="mt-14">
      <h3 className="display-italic text-center text-[2.2rem]">{t('wishlist')}</h3>
      <p className="mx-auto mt-2 max-w-[22rem] text-center text-sm text-muted">{t('wishlistHint')}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {q.data.map((it) => {
          const full = it.claimed >= it.qty;
          return (
            <li key={it.id} className={`glass flex gap-4 rounded-2xl p-3 ${full && !it.mine ? 'opacity-60' : ''}`}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <GiftIcon aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{it.name}</p>
                {it.description && <p className="mt-0.5 text-xs text-muted">{it.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {it.mine ? (
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => unclaim.mutate(it.id)} disabled={unclaim.isPending}>
                      {t('unclaim')}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary !px-3 !py-1.5 text-xs" disabled={full} onClick={() => setAsking(it)}>
                      {full ? t('claimed') : t('claim')}
                    </button>
                  )}
                  <span className="text-xs text-muted tabular-nums">
                    {it.claimed}/{it.qty}
                  </span>
                  {it.link && (
                    <a href={it.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                      {t('viewItem')} <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={!!asking} onClose={() => setAsking(null)} label={t('claim')}>
        {asking && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              claim.mutate(asking.id);
            }}
            className="flex flex-col gap-4"
          >
            <p className="display-italic pr-8 text-2xl">{asking.name}</p>
            <label className="text-sm">
              {t('claimNamePrompt')}
              <input className="field mt-1" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="name" />
            </label>
            <button className="btn btn-primary" disabled={claim.isPending || !name.trim()}>
              {t('claim')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function Gift({ c, guestCode, guestName }: { c: InvitationContent; guestCode: string | null; guestName: string }) {
  const { t } = useTranslation();
  const { l } = useL();
  const g = c.gift;
  const [qr, setQr] = useState<string | null>(null);
  return (
    <Section
      id="gift"
      decor={
        <Depth depth={0.5} className="absolute -left-8 top-32">
          <Bloom size={80} tone="cream" rotate={20} />
        </Depth>
      }
    >
      <SectionTitle sub={l(g.intro)}>{t('gift')}</SectionTitle>

      <div className="flex flex-col gap-4">
        {g.accounts.map((a, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <motion.div
              className="relative overflow-hidden rounded-[1.6rem] p-6 text-white shadow-[0_24px_50px_-28px_rgb(61_51_69/0.7)]"
              style={{ background: `linear-gradient(135deg, var(--c-primary), color-mix(in oklab, var(--c-primary) 55%, var(--c-accent)))` }}
              whileHover={{ rotateY: 6, rotateX: -4 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold tracking-wide">{a.provider}</span>
                {a.type === 'bank' ? <Landmark aria-hidden /> : <Wallet aria-hidden />}
              </div>
              <p className="mt-6 font-sans text-[1.5rem] tracking-[0.12em] tabular-nums">{a.number}</p>
              <p className="mt-1 text-sm text-white/85">{t('accountHolder', { holder: a.holder })}</p>
              <div className="mt-5 flex gap-2">
                <CopyButton text={a.number.replace(/\s/g, '')} toastMsg={t('copiedToast')} className="!border-white/40 !bg-white/15 !text-white hover:!bg-white/25" />
                {a.qrImage && (
                  <button type="button" onClick={() => setQr(a.qrImage)} className="btn !border !border-white/40 !bg-white/15 !px-4 !py-2 text-sm text-white hover:!bg-white/25">
                    <QrCode size={16} aria-hidden /> {t('showQr')}
                  </button>
                )}
              </div>
            </motion.div>
          </Reveal>
        ))}

        {g.addressEnabled && g.address && (
          <Reveal>
            <div className="glass rounded-[1.6rem] p-6">
              <p className="flex items-center gap-2 font-medium">
                <MapPin size={18} className="text-accent" aria-hidden /> {t('sendGiftTo')}
              </p>
              <p className="mt-3 font-medium">{g.addressRecipient}</p>
              <p className="text-sm text-ink/80">{g.address}</p>
              {g.addressPhone && <p className="text-sm text-muted">{g.addressPhone}</p>}
              <CopyButton text={[g.addressRecipient, g.address, g.addressPhone].filter(Boolean).join('\n')} toastMsg={t('addressCopied')} className="mt-4" />
            </div>
          </Reveal>
        )}

        {g.confirmationEnabled && (
          <Reveal>
            <details className="glass group rounded-[1.6rem] p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {t('confirmGift')}
                <span aria-hidden className="text-xl text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4">
                <ConfirmForm guestCode={guestCode} defaultName={guestName} />
              </div>
            </details>
          </Reveal>
        )}
      </div>

      {g.wishlistEnabled && <Wishlist guestCode={guestCode} defaultName={guestName} />}

      <Modal open={!!qr} onClose={() => setQr(null)} label={t('showQr')}>
        {qr && <img src={qr} alt="QR" className="mx-auto mt-6 w-full max-w-[18rem] rounded-xl" />}
      </Modal>
    </Section>
  );
}
