import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Attendance, InvitationContent, PublicGuest } from '@sakinah/shared';
import { api, errorMessage } from '../../lib/api';
import { clientToken, rememberName } from '../../lib/clientToken';
import { Section, SectionTitle } from '../motion';
import { SegmentedChoice } from '../ui';

interface Mine {
  attendance: Attendance;
  pax: number;
  message: string;
  name?: string;
}

export function Rsvp({ c, guestCode, guest, guestName }: { c: InvitationContent; guestCode: string | null; guest: PublicGuest | null; guestName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const token = clientToken();
  const closed = !!c.rsvp.deadline && Date.now() > Date.parse(c.rsvp.deadline);
  const maxPax = guest?.maxPax ?? c.rsvp.maxPaxDefault;

  // Anonymous guests: load their previous RSVP by browser token.
  const mine = useQuery({
    queryKey: ['rsvp-me', token],
    queryFn: () => api<Mine | null>(`/api/rsvp/me?token=${encodeURIComponent(token)}`),
    enabled: !guestCode,
  });
  const existing: Mine | null = guest?.rsvp ?? mine.data ?? null;

  const [name, setName] = useState(guest?.name || rememberName() || guestName);
  const [attendance, setAttendance] = useState<Attendance>('yes');
  const [pax, setPax] = useState(1);
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');

  useEffect(() => {
    if (!existing) return;
    setAttendance(existing.attendance);
    setPax(Math.max(1, existing.pax));
    setMessage(existing.message);
    if (existing.name) setName(existing.name);
  }, [existing]);

  const m = useMutation({
    mutationFn: () =>
      api<{ pax: number }>('/api/rsvp', {
        method: 'POST',
        json: { guestCode: guestCode ?? undefined, name, attendance, pax: attendance === 'no' ? 0 : pax, message, clientToken: token, website: hp },
      }),
    onSuccess: () => {
      rememberName(name);
      toast.success(t('rsvpSaved'));
      void qc.invalidateQueries({ queryKey: ['rsvp-me'] });
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };

  return (
    <Section id="rsvp">
      <SectionTitle sub={closed ? t('rsvpClosed') : t('rsvpHint')}>{t('rsvp')}</SectionTitle>
      {existing && (
        <p className="mb-5 text-center text-sm text-accent">{t('rsvpCurrent', { status: t(`att_${existing.attendance}`) })}</p>
      )}
      {!closed && (
        <motion.form
          onSubmit={submit}
          className="glass flex flex-col gap-5 rounded-[2rem] p-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.8 }}
        >
          <label className="text-sm">
            {t('yourName')}
            <input className="field mt-1" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} readOnly={!!guest} autoComplete="name" />
          </label>
          <div className="text-sm">
            <span>{t('attendance')}</span>
            <div className="mt-1">
              <SegmentedChoice<Attendance>
                name={t('attendance')}
                value={attendance}
                onChange={setAttendance}
                options={(['yes', 'no', 'maybe'] as const).map((v) => ({ value: v, label: t(`att_${v}`) }))}
              />
            </div>
          </div>
          {attendance !== 'no' && (
            <div className="flex items-center justify-between text-sm">
              <span id="pax-label">{t('pax')}</span>
              <div className="flex items-center gap-3" role="group" aria-labelledby="pax-label">
                <button type="button" className="btn btn-ghost !p-2" aria-label="−" disabled={pax <= 1} onClick={() => setPax((p) => Math.max(1, p - 1))}>
                  <Minus size={16} aria-hidden />
                </button>
                <span className="w-16 text-center tabular-nums" aria-live="polite">
                  {t('paxCount', { count: pax })}
                </span>
                <button type="button" className="btn btn-ghost !p-2" aria-label="+" disabled={pax >= maxPax} onClick={() => setPax((p) => Math.min(maxPax, p + 1))}>
                  <Plus size={16} aria-hidden />
                </button>
              </div>
            </div>
          )}
          <label className="text-sm">
            {t('messageOptional')}
            <textarea className="field mt-1" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
          <button className="btn btn-primary" disabled={m.isPending || !name.trim()}>
            {existing ? t('updateRsvp') : t('sendRsvp')}
          </button>
        </motion.form>
      )}
    </Section>
  );
}
