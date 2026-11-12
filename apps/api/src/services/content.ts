import { eq } from 'drizzle-orm';
import { contentSchema, defaultContent, type InvitationContent } from '@wedding/shared';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { settings, wishlistItems } from '../db/schema.js';

const KEY = 'content';

export interface StoredContent {
  content: InvitationContent;
  updatedAt: string;
  /** Paths of stored values that failed validation and were reset (e.g. after an upgrade). */
  repaired?: string[];
}

type Obj = Record<string | number, unknown>;

function getAt(root: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Obj)[k as string] : undefined), root);
}

/**
 * Make stored content valid again with the smallest change: reset each failing value to the
 * default at the same path, or to an empty/neutral value if the default has no such path
 * (e.g. item 5 of a list). Never swaps the whole document for demo content.
 */
export function repairContent(input: unknown): { content: InvitationContent; repaired: string[] } | null {
  let draft = structuredClone(input) as Obj;
  const repaired: string[] = [];
  for (let pass = 0; pass < 8; pass++) {
    const r = contentSchema.safeParse(draft);
    if (r.success) return { content: r.data, repaired };
    for (const issue of r.error.issues) {
      const path = issue.path;
      if (path.length === 0) {
        draft = structuredClone(defaultContent) as unknown as Obj;
        repaired.push('(all)');
        continue;
      }
      const parent = getAt(draft, path.slice(0, -1));
      const key = path[path.length - 1] as string;
      if (!parent || typeof parent !== 'object') continue;
      const def = getAt(defaultContent, path);
      const cur = (parent as Obj)[key];
      let next: unknown = def;
      if (def === undefined) {
        if (Array.isArray(parent)) {
          (parent as unknown[]).splice(Number(key), 1);
          repaired.push(path.join('.'));
          continue;
        }
        next = typeof cur === 'string' ? '' : typeof cur === 'boolean' ? false : undefined;
      }
      if (next === undefined) delete (parent as Obj)[key];
      else (parent as Obj)[key] = structuredClone(next);
      repaired.push(path.join('.'));
    }
  }
  return null;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Deep-merge `over` onto `base`. Objects merge; arrays and scalars from `over` win. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || Array.isArray(over)) return (over ?? base) as T;
  if (base && typeof base === 'object' && over && typeof over === 'object') {
    const out: Record<string, Json> = { ...(base as Record<string, Json>) };
    for (const [k, v] of Object.entries(over as Record<string, Json>)) {
      out[k] = k in out ? deepMerge(out[k] as Json, v) : v;
    }
    return out as T;
  }
  return (over === undefined ? base : over) as T;
}

export class ContentService {
  private cache: StoredContent | null = null;

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {}

  /** Seed demo content on first boot. */
  ensureSeeded(): void {
    const row = this.db.select().from(settings).where(eq(settings.key, KEY)).get();
    if (!row) {
      this.db
        .insert(settings)
        .values({ key: KEY, value: JSON.stringify(defaultContent) })
        .run();
      this.db
        .insert(wishlistItems)
        .values([
          { name: 'Rice cooker', description: 'Digital, 1.8 L', qty: 1, sort: 1 },
          { name: 'Set sprei katun', description: 'Ukuran 180×200, warna netral', qty: 2, sort: 2 },
          { name: 'Tanaman hias', description: 'Untuk rumah baru kami 🌿', qty: 3, sort: 3 },
        ])
        .run();
      this.log.info('Seeded default invitation content and demo wishlist');
    }
  }

  get(): StoredContent {
    if (this.cache) return this.cache;
    const row = this.db.select().from(settings).where(eq(settings.key, KEY)).get();
    if (!row) {
      this.ensureSeeded();
      return this.get();
    }
    // Merge onto defaults so new fields added in upgrades get sensible values.
    const merged = deepMerge(defaultContent, JSON.parse(row.value) as unknown);
    const parsed = contentSchema.safeParse(merged);
    if (parsed.success) {
      this.cache = { content: parsed.data, updatedAt: row.updatedAt };
      return this.cache;
    }
    const fixed = repairContent(merged);
    if (!fixed) throw new Error('Stored invitation content is invalid and could not be repaired');
    this.log.warn({ repaired: fixed.repaired }, 'Stored content had invalid values; reset them (re-check in the admin editor)');
    this.cache = { content: fixed.content, updatedAt: row.updatedAt, repaired: fixed.repaired };
    return this.cache;
  }

  /**
   * Replace content. `expectedUpdatedAt` enables optimistic concurrency: if another
   * admin tab saved in between, returns `conflict` instead of overwriting.
   */
  put(
    content: InvitationContent,
    expectedUpdatedAt?: string,
  ): { ok: true; updatedAt: string } | { ok: false; conflict: true; updatedAt: string } {
    const current = this.get();
    if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true, updatedAt: current.updatedAt };
    }
    // Guarantee strictly increasing timestamps even within the same millisecond.
    let updatedAt = new Date().toISOString();
    if (updatedAt <= current.updatedAt) {
      updatedAt = new Date(Date.parse(current.updatedAt) + 1).toISOString();
    }
    this.db
      .insert(settings)
      .values({ key: KEY, value: JSON.stringify(content), updatedAt })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(content), updatedAt } })
      .run();
    this.cache = { content, updatedAt };
    return { ok: true, updatedAt };
  }
}
