import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, ExternalLink, Gift, Image, LogOut, MessageSquareHeart, Palette, Settings, Users, CalendarCheck } from 'lucide-react';
import { api, ApiRequestError, setCsrfToken } from '../lib/api';
import { useMe } from './hooks';
import { Login } from './Login';
import { Bloom } from '../invitation/ornaments/Florals';
import { Overview } from './pages/Overview';

const Guests = lazy(() => import('./pages/Guests'));
const Rsvps = lazy(() => import('./pages/Rsvps'));
const Wishes = lazy(() => import('./pages/Wishes'));
const Gifts = lazy(() => import('./pages/Gifts'));
const ContentEditor = lazy(() => import('./pages/Content'));
const Media = lazy(() => import('./pages/Media'));
const SettingsPage = lazy(() => import('./pages/Settings'));

const NAV = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/rsvps', label: 'RSVPs', icon: CalendarCheck },
  { to: '/admin/wishes', label: 'Wishes', icon: MessageSquareHeart },
  { to: '/admin/gifts', label: 'Gifts', icon: Gift },
  { to: '/admin/content', label: 'Content', icon: Palette },
  { to: '/admin/media', label: 'Media', icon: Image },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminApp() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Admin · Sakinah';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  if (me.isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center" aria-busy="true">
        <div className="animate-pulse">
          <Bloom size={48} />
        </div>
      </main>
    );
  }
  if (me.error instanceof ApiRequestError && me.error.status === 401) return <Login />;
  if (me.isError || !me.data) {
    return <main className="p-8 text-center text-sm text-muted">Couldn&apos;t reach the server. Check that the API is running, then reload.</main>;
  }

  const logout = async () => {
    await api('/api/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    setCsrfToken('');
    qc.clear();
    navigate('/admin');
    await qc.invalidateQueries({ queryKey: ['admin', 'me'] });
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary-soft font-medium text-ink' : 'text-muted hover:bg-line/60 hover:text-ink'}`;

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-line bg-surface/70 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Bloom size={30} />
          <span className="display text-xl">Sakinah</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
              <n.icon size={18} aria-hidden /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <a href="/" target="_blank" rel="noopener" className={linkCls({ isActive: false })}>
            <ExternalLink size={18} aria-hidden /> View invitation
          </a>
          <button type="button" onClick={logout} className={linkCls({ isActive: false })}>
            <LogOut size={18} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="flex items-center gap-2">
          <Bloom size={24} />
          <span className="display text-lg">Sakinah</span>
        </span>
        <div className="flex gap-1">
          <NavLink to="/admin/media" className="rounded-full p-2 text-muted hover:bg-line" aria-label="Media">
            <Image size={18} aria-hidden />
          </NavLink>
          <NavLink to="/admin/settings" className="rounded-full p-2 text-muted hover:bg-line" aria-label="Settings">
            <Settings size={18} aria-hidden />
          </NavLink>
          <a href="/" target="_blank" rel="noopener" className="rounded-full p-2 text-muted hover:bg-line" aria-label="View invitation">
            <ExternalLink size={18} aria-hidden />
          </a>
          <button type="button" onClick={logout} className="rounded-full p-2 text-muted hover:bg-line" aria-label="Sign out">
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="guests" element={<Guests publicUrl={me.data.publicUrl} />} />
            <Route path="rsvps" element={<Rsvps />} />
            <Route path="wishes" element={<Wishes />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="content" element={<ContentEditor />} />
            <Route path="media" element={<Media />} />
            <Route path="settings" element={<SettingsPage username={me.data.username} />} />
          </Routes>
        </Suspense>
      </main>

      {/* Bottom tabs (mobile) */}
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface/95 px-1 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur lg:hidden">
        {NAV.filter((n) => !['/admin/media', '/admin/settings'].includes(n.to)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[0.65rem] ${isActive ? 'text-primary' : 'text-muted'}`}
          >
            <n.icon size={20} aria-hidden />
            <span className="truncate">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
