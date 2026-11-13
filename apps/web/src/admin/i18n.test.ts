import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../lib/api';
import { adminErrorMessage, adminI18n, namespaces } from './i18n';

type Dict = { [k: string]: string | Dict };

/** Flatten to dotted keys, folding i18next plural suffixes so `x_one`/`x_other` count as `x`. */
function keys(d: Dict, prefix = ''): string[] {
  return Object.entries(d).flatMap(([k, v]) =>
    typeof v === 'string'
      ? [`${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`]
      : keys(v, `${prefix}${k}.`),
  );
}

function values(d: Dict): string[] {
  return Object.values(d).flatMap((v) => (typeof v === 'string' ? [v] : values(v)));
}

describe('admin translations', () => {
  it('has namespaces', () => {
    expect(Object.keys(namespaces)).toContain('common');
  });

  for (const [ns, mod] of Object.entries(namespaces)) {
    it(`${ns}: Indonesian and English have the same keys`, () => {
      expect([...new Set(keys(mod.id))].sort()).toEqual([...new Set(keys(mod.en))].sort());
    });
    it(`${ns}: no empty strings`, () => {
      expect([...values(mod.id), ...values(mod.en)].filter((v) => !v.trim())).toEqual([]);
    });
  }

  it('defaults to Indonesian', () => {
    expect(adminI18n.language).toBe('id');
    expect(adminI18n.t('nav.overview')).toBe('Ringkasan');
  });

  it('translates known server errors', async () => {
    await adminI18n.changeLanguage('id');
    const err = new ApiRequestError(401, { error: 'Invalid username or password' });
    expect(adminErrorMessage(err)).toBe('Nama pengguna atau kata sandi salah');
    const rate = new ApiRequestError(429, { error: 'Too many failed sign-ins. Try again in 5 minutes.' });
    expect(adminErrorMessage(rate)).toContain('5 menit');
    await adminI18n.changeLanguage('en');
    expect(adminErrorMessage(err)).toBe('Invalid username or password');
    await adminI18n.changeLanguage('id');
  });
});
