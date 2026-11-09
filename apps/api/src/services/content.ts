import { eq } from 'drizzle-orm';
import { contentSchema, defaultContent, type InvitationContent } from '@sakinah/shared';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { settings } from '../db/schema.js';

const KEY = 'content';

export interface StoredContent {
  content: InvitationContent;
  updatedAt: string;
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
      this.log.info('Seeded default invitation content');
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
    if (!parsed.success) {
      this.log.error({ issues: parsed.error.issues }, 'Stored content is invalid; serving defaults');
      return { content: defaultContent, updatedAt: row.updatedAt };
    }
    this.cache = { content: parsed.data, updatedAt: row.updatedAt };
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
