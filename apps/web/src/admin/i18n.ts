/**
 * Admin dashboard translations.
 *
 * The admin has its own i18next instance so its language is independent of the language guests
 * pick on the invitation. Indonesian is the default; the choice is remembered per browser.
 *
 * Every file in ./locales is a namespace named after the file (e.g. locales/guests.ts → "guests")
 * and default-exports `{ id: {...}, en: {...} }`. Components call `useTranslation('guests')`;
 * keys missing from a namespace fall back to "common".
 */
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ApiRequestError } from '../lib/api';

export type AdminLocale = 'id' | 'en';
export const ADMIN_LOCALES: { id: AdminLocale; label: string; name: string }[] = [
  { id: 'id', label: 'ID', name: 'Bahasa Indonesia' },
  { id: 'en', label: 'EN', name: 'English' },
];

type Dict = { [k: string]: string | Dict };
export type LocaleModule = { id: Dict; en: Dict };

const modules = import.meta.glob<LocaleModule>('./locales/*.ts', { eager: true, import: 'default' });

export const namespaces: Record<string, LocaleModule> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.replace(/^.*\/(.+)\.ts$/, '$1'), mod]),
);

const resources = {
  id: Object.fromEntries(Object.entries(namespaces).map(([ns, m]) => [ns, m.id])),
  en: Object.fromEntries(Object.entries(namespaces).map(([ns, m]) => [ns, m.en])),
};

const LS_KEY = 'invitation.admin.lang';

function storedLocale(): AdminLocale {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'id' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return 'id';
}

export const adminI18n = createInstance();
void adminI18n.use(initReactI18next).init({
  resources,
  lng: storedLocale(),
  fallbackLng: 'id',
  ns: Object.keys(namespaces),
  defaultNS: 'common',
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
});

export function setAdminLocale(l: AdminLocale) {
  void adminI18n.changeLanguage(l);
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LS_KEY, l);
  } catch {
    /* ignore */
  }
}

export const adminLocale = (): AdminLocale => (adminI18n.language === 'en' ? 'en' : 'id');

/** BCP-47 tag for Intl formatting in the admin's current language. */
export const adminIntlLocale = () => (adminLocale() === 'en' ? 'en-GB' : 'id-ID');

/** Shorthand for translating outside React components (toasts in callbacks, confirm() prompts). */
export const at = adminI18n.t.bind(adminI18n);

/**
 * Server and network errors arrive in English. Translate the ones we know; validation issues get a
 * generic message naming the field.
 */
export function adminErrorMessage(e: unknown): string {
  const t = adminI18n.t.bind(adminI18n);
  const known = (namespaces.errors?.en ?? {}) as Record<string, string>;
  const lookup = (msg: string) => {
    const key = Object.keys(known).find((k) => known[k] === msg);
    return key ? t(`errors:${key}`) : null;
  };
  if (e instanceof ApiRequestError) {
    const issue = e.body?.issues?.[0];
    if (issue) {
      const message = lookup(issue.message) ?? issue.message;
      return issue.path ? t('errors:invalidField', { field: issue.path, message }) : message;
    }
    const msg = e.body?.error ?? '';
    const hit = lookup(msg);
    if (hit) return hit;
    const signIn = /^Too many failed sign-ins\. Try again in (\d+) minute/.exec(msg);
    if (signIn) return t('errors:tooManySignIns', { count: Number(signIn[1]) });
    const type = /^Unsupported file type: (.+)$/.exec(msg);
    if (type) return t('errors:unsupportedType', { type: type[1] });
    if (msg) return msg;
    return t('errors:requestFailed', { status: e.status });
  }
  if (e instanceof TypeError) return t('errors:network');
  return e instanceof Error ? e.message : String(e);
}
