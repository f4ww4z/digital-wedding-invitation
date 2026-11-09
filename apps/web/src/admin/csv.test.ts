import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToGuests, waNumber } from './csv';

describe('csv import', () => {
  it('parses quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });
  it('detects semicolon delimiters (Excel ID locale)', () => {
    expect(parseCsv('nama;grup\nBudi;Kantor')).toEqual([
      ['nama', 'grup'],
      ['Budi', 'Kantor'],
    ]);
  });
  it('maps header aliases and skips blank names', () => {
    const g = rowsToGuests(parseCsv('Nama,Grup,No HP,Pax\nBudi,Kantor,0812,3\n,,,\nAni,,,99'));
    expect(g).toEqual([
      { name: 'Budi', group: 'Kantor', phone: '0812', maxPax: 3, notes: undefined },
      { name: 'Ani', group: undefined, phone: undefined, maxPax: undefined, notes: undefined },
    ]);
  });
  it('does not mistake a notes column for the phone column', () => {
    expect(rowsToGuests(parseCsv("name,notes,phone\nBudi,vegetarian,'+62812"))[0]).toMatchObject({ phone: '+62812', notes: 'vegetarian' });
  });
  it('works without a header', () => {
    expect(rowsToGuests([['Citra', 'Family']])[0]).toMatchObject({ name: 'Citra', group: 'Family' });
  });
  it('normalises phone numbers for WhatsApp', () => {
    expect(waNumber('0812-3456-7890')).toBe('6281234567890');
    expect(waNumber('+62 812 3456')).toBe('628123456');
  });
});
