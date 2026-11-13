import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ADMIN_LOCALES, adminLocale, setAdminLocale } from '../i18n';

/** Segmented ID | EN control for the admin's own language. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'id';

  if (compact) {
    // Mobile top bar: one button that flips to the other language.
    const next = ADMIN_LOCALES.find((l) => l.id !== adminLocale())!;
    return (
      <button
        type="button"
        onClick={() => setAdminLocale(next.id)}
        className="flex items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-muted hover:bg-line"
        aria-label={t('switchLanguage', { name: next.name })}
        title={t('switchLanguage', { name: next.name })}
      >
        <Languages size={18} aria-hidden />
        {current.toUpperCase()}
      </button>
    );
  }

  return (
    <div className="px-3 py-2" role="group" aria-label={t('languageHint')}>
      <p className="mb-1.5 flex items-center gap-2 text-xs text-muted">
        <Languages size={14} aria-hidden /> {t('language')}
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-line/60 p-1">
        {ADMIN_LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            lang={l.id}
            aria-pressed={current === l.id}
            onClick={() => setAdminLocale(l.id)}
            title={l.name}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              current === l.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {l.id === 'id' ? 'Indonesia' : 'English'}
          </button>
        ))}
      </div>
    </div>
  );
}
