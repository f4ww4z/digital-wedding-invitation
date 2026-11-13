import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import { api, setCsrfToken } from '../../lib/api';
import { adminErrorMessage } from '../i18n';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { Card, PageHeader } from '../components/ui';

export default function Settings({ username }: { username: string }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try {
      const r = await api<{ csrfToken: string }>('/api/admin/auth/password', { method: 'POST', json: { currentPassword: current, newPassword: next } });
      setCsrfToken(r.csrfToken);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success(t('settings.changed'));
    } catch (err) {
      toast.error(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.signedInAs', { username })} />
      <Card className="max-w-lg">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound size={18} aria-hidden /> {t('settings.changePassword')}
        </h2>
        <p className="mt-1 text-xs text-muted">
          <Trans i18nKey="settings.changeHint" components={{ code: <code /> }} />
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            {t('settings.current')}
            <input className="field mt-1" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="text-sm">
            {t('settings.new')}
            <input className="field mt-1" type="password" autoComplete="new-password" minLength={10} required value={next} onChange={(e) => setNext(e.target.value)} />
            <span className="mt-1 block text-xs text-muted">{t('settings.minLength')}</span>
          </label>
          <label className="text-sm">
            {t('settings.repeat')}
            <input className="field mt-1" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
            {mismatch && <span className="mt-1 block text-xs text-[#9c3353]">{t('settings.mismatch')}</span>}
          </label>
          <button className="btn btn-primary mt-2 self-start" disabled={busy || mismatch || next.length < 10}>
            {t('settings.changePassword')}
          </button>
        </form>
      </Card>
      <Card className="mt-6 max-w-lg">
        <h2 className="font-semibold">{t('settings.languageTitle')}</h2>
        <p className="mt-1 text-xs text-muted">{t('settings.languageBody')}</p>
        <div className="-mx-3 mt-2 max-w-xs">
          <LanguageSwitch />
        </div>
      </Card>
    </>
  );
}
