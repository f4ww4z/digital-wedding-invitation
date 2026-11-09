import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, setCsrfToken } from '../../lib/api';
import { Card, PageHeader } from '../components/ui';

export default function Settings({ username }: { username: string }) {
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
      toast.success('Password changed. Other devices were signed out.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${username}.`} />
      <Card className="max-w-lg">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound size={18} aria-hidden /> Change password
        </h2>
        <p className="mt-1 text-xs text-muted">
          Changing it here signs out every other device. If you later change ADMIN_PASSWORD in <code>.env</code>, that value takes over on the next restart.
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            Current password
            <input className="field mt-1" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="text-sm">
            New password
            <input className="field mt-1" type="password" autoComplete="new-password" minLength={10} required value={next} onChange={(e) => setNext(e.target.value)} />
            <span className="mt-1 block text-xs text-muted">At least 10 characters.</span>
          </label>
          <label className="text-sm">
            Repeat new password
            <input className="field mt-1" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
            {mismatch && <span className="mt-1 block text-xs text-[#9c3353]">Passwords don't match.</span>}
          </label>
          <button className="btn btn-primary mt-2 self-start" disabled={busy || mismatch || next.length < 10}>
            Change password
          </button>
        </form>
      </Card>
    </>
  );
}
