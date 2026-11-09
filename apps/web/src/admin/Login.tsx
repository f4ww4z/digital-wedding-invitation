import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { api, errorMessage, setCsrfToken } from '../lib/api';
import { Bloom } from '../invitation/ornaments/Florals';

export function Login() {
  const qc = useQueryClient();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ csrfToken: string }>('/api/admin/auth/login', { method: 'POST', json: { username, password } });
      setCsrfToken(r.csrfToken);
      await qc.invalidateQueries({ queryKey: ['admin', 'me'] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-[0_30px_60px_-40px_rgb(61_51_69/0.6)]">
        <div className="mb-6 flex items-center gap-3">
          <Bloom size={40} />
          <div>
            <h1 className="display text-2xl">Admin</h1>
            <p className="text-sm text-muted">Sign in to manage your invitation.</p>
          </div>
        </div>
        <label className="block text-sm">
          Username
          <input className="field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="mt-4 block text-sm">
          Password
          <input className="field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-[#c2456a]/10 px-3 py-2 text-sm text-[#9c3353]">
            {error}
          </p>
        )}
        <button className="btn btn-primary mt-6 w-full" disabled={busy}>
          <LogIn size={18} aria-hidden /> Sign in
        </button>
      </form>
    </main>
  );
}
