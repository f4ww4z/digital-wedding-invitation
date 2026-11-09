/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Also accepts ; or tab delimiters. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export interface ImportedGuest {
  name: string;
  group?: string;
  phone?: string;
  maxPax?: number;
  notes?: string;
}

/** Map rows to guests. Uses a header row if present (name/nama, group/grup, phone/hp/wa, pax, notes). */
export function rowsToGuests(rows: string[][]): ImportedGuest[] {
  if (!rows.length) return [];
  const head = rows[0]!.map((h) => h.trim().toLowerCase());
  const find = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));
  const hasHeader = find('name', 'nama') !== -1;
  const idx = hasHeader
    ? {
        name: find('name', 'nama'),
        group: find('group', 'grup', 'kelompok'),
        phone: find('phone', 'hp', 'wa', 'telepon', 'nomor', 'no hp', 'no. hp', 'no wa', 'no telp'),
        pax: find('max_pax', 'pax', 'jumlah'),
        notes: find('notes', 'catatan'),
      }
    : { name: 0, group: 1, phone: 2, pax: 3, notes: 4 };
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((r) => {
      const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
      const pax = Number.parseInt(get(idx.pax), 10);
      return {
        name: get(idx.name).slice(0, 120),
        group: get(idx.group).slice(0, 60) || undefined,
        // Strip the apostrophe spreadsheet apps add to protect leading "+".
        phone: get(idx.phone).replace(/^'/, '').slice(0, 30) || undefined,
        maxPax: Number.isFinite(pax) && pax >= 1 && pax <= 20 ? pax : undefined,
        notes: get(idx.notes).slice(0, 500) || undefined,
      };
    })
    .filter((g) => g.name);
}

/** Normalise an Indonesian-style phone number for wa.me (08xx → 628xx). */
export function waNumber(phone: string): string {
  let p = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  return p;
}
