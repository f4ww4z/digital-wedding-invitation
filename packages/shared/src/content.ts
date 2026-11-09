import { z } from 'zod';
import { etiquetteIcons } from './util.js';

/** Max lengths keep stored content and rendered pages bounded. */
const short = (max = 120) => z.string().trim().max(max);
const long = (max = 4000) => z.string().trim().max(max);

/**
 * A URL that is either site-relative (e.g. `/media/abc.webp`, `/demo/couple.webp`)
 * or absolute http(s). Blocks `javascript:`/`data:` and protocol-relative URLs.
 */
export const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) =>
      v === '' ||
      // No whitespace/control chars anywhere: browsers strip tabs/newlines, turning "/\t/x" into "//x".
      // eslint-disable-next-line no-control-regex -- intentionally rejecting control chars
      (!/[\s\u0000-\u001f\u007f]/.test(v) && ((/^\/(?!\/)/.test(v) && !v.includes('\\')) || /^https?:\/\/[^/]/i.test(v))),
    { message: 'Must be empty, a site path starting with "/", or an http(s) URL (no spaces)' },
  );

export const localeSchema = z.enum(['id', 'en']);
export type Locale = z.infer<typeof localeSchema>;
export const LOCALES: readonly Locale[] = ['id', 'en'];

/** Localized text: Indonesian + English. */
export const lText = (max = 4000) => z.object({ id: long(max), en: long(max) });
export type LText = { id: string; en: string };

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #c9a0a0');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');

export const personSchema = z.object({
  nickname: short(40),
  fullName: short(120),
  photo: safeUrl,
  childOrder: lText(120),
  parents: lText(240),
  instagram: short(60).regex(/^[A-Za-z0-9._]*$/, 'Instagram handle without @'),
});
export type Person = z.infer<typeof personSchema>;

export const eventSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  name: lText(80),
  date: isoDate,
  startTime: hhmm,
  endTime: z.union([hhmm, z.literal('')]),
  /** Display label for the timezone, e.g. "WIB". */
  timezoneLabel: short(10),
  /** UTC offset in minutes, used for countdown/calendar. WIB = 420. */
  utcOffsetMinutes: z.number().int().min(-720).max(840),
  venue: short(160),
  address: long(400),
  mapsUrl: safeUrl,
  mapsEmbedQuery: short(300),
});
export type WeddingEvent = z.infer<typeof eventSchema>;

export const storyItemSchema = z.object({
  title: lText(80),
  date: lText(60),
  text: lText(1500),
  image: safeUrl,
});

export const galleryImageSchema = z.object({ src: safeUrl, alt: short(160) });

export { etiquetteIcons };
export const etiquetteItemSchema = z.object({ icon: z.enum(etiquetteIcons), text: lText(160) });

export const giftAccountSchema = z.object({
  type: z.enum(['bank', 'ewallet']),
  provider: short(60),
  number: short(60),
  holder: short(120),
  qrImage: safeUrl,
});
export type GiftAccount = z.infer<typeof giftAccountSchema>;

export const themeSchema = z.object({
  preset: z.enum(['garden']),
  primary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
});

export const contentSchema = z.object({
  meta: z.object({
    title: short(120),
    description: short(300),
    ogImage: safeUrl,
    /** Off by default: guest names appear in invitation URLs. */
    allowIndexing: z.boolean(),
  }),
  theme: themeSchema,
  defaultLocale: localeSchema,
  cover: z.object({
    eyebrow: lText(60),
    guestPrefix: lText(60),
    defaultGuest: lText(60),
    openButton: lText(40),
  }),
  music: z.object({ enabled: z.boolean(), src: safeUrl, title: short(120) }),
  couple: z.object({
    order: z.enum(['bride-first', 'groom-first']),
    bride: personSchema,
    groom: personSchema,
  }),
  opening: z.object({
    greeting: lText(200),
    intro: lText(600),
    verseEnabled: z.boolean(),
    verseArabic: long(1000),
    verseText: lText(1000),
    verseSource: short(80),
  }),
  events: z.array(eventSchema).min(1).max(6),
  countdown: z.object({ enabled: z.boolean() }),
  story: z.object({ enabled: z.boolean(), items: z.array(storyItemSchema).max(12) }),
  gallery: z.object({ enabled: z.boolean(), images: z.array(galleryImageSchema).max(40) }),
  livestream: z.object({
    enabled: z.boolean(),
    url: safeUrl,
    platform: short(40),
    text: lText(300),
  }),
  etiquette: z.object({ enabled: z.boolean(), items: z.array(etiquetteItemSchema).max(12) }),
  gift: z.object({
    enabled: z.boolean(),
    intro: lText(600),
    accounts: z.array(giftAccountSchema).max(8),
    addressEnabled: z.boolean(),
    addressRecipient: short(120),
    address: long(400),
    addressPhone: short(40),
    confirmationEnabled: z.boolean(),
    wishlistEnabled: z.boolean(),
  }),
  rsvp: z.object({
    enabled: z.boolean(),
    /** ISO datetime (UTC) after which RSVPs are closed; empty = never. */
    deadline: z.union([z.iso.datetime(), z.literal('')]),
    maxPaxDefault: z.number().int().min(1).max(20),
  }),
  wishes: z.object({ enabled: z.boolean(), requireApproval: z.boolean() }),
  closing: z.object({ text: lText(600), signature: lText(120), image: safeUrl }),
  share: z.object({ whatsappTemplate: lText(1500) }),
});

export type InvitationContent = z.infer<typeof contentSchema>;

export { weddingStart, eventStart, eventEnd, fillTemplate } from './util.js';
