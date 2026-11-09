import { z } from 'zod';
import { safeUrl } from './content.js';

/** Collapse whitespace runs and strip control chars; HTML is escaped at render time by React. */
const clean = (max: number) =>
  z
    .string()
    // eslint-disable-next-line no-control-regex -- intentionally stripping control chars
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
    .pipe(z.string().max(max));

const name = clean(80).pipe(z.string().min(1, 'Name is required'));
/** Random per-browser token so guests can edit their own RSVP / cancel their own claim. */
export const clientToken = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
/** Honeypot: must be empty. Bots fill every field. */
const honeypot = z.string().max(0).optional();

export const attendanceSchema = z.enum(['yes', 'no', 'maybe']);
export type Attendance = z.infer<typeof attendanceSchema>;

export const guestCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/);

export const rsvpInput = z.object({
  guestCode: guestCodeSchema.optional(),
  name,
  attendance: attendanceSchema,
  pax: z.number().int().min(0).max(20),
  message: clean(500).optional().default(''),
  clientToken,
  website: honeypot,
});
export type RsvpInput = z.input<typeof rsvpInput>;

export const wishInput = z.object({
  guestCode: guestCodeSchema.optional(),
  name,
  message: clean(1000).pipe(z.string().min(1, 'Message is required')),
  /** Lets the server show the sender's RSVP status as a badge (never trusted from the client). */
  clientToken: clientToken.optional(),
  website: honeypot,
});
export type WishInput = z.input<typeof wishInput>;

export const giftMethodSchema = z.enum(['transfer', 'ewallet', 'physical', 'other']);
export const giftConfirmInput = z.object({
  guestCode: guestCodeSchema.optional(),
  name,
  method: giftMethodSchema,
  /** Optional amount in the smallest display unit (e.g. Rupiah). */
  amount: z.number().int().min(0).max(10_000_000_000).optional(),
  target: clean(120).optional().default(''),
  note: clean(500).optional().default(''),
  website: honeypot,
});
export type GiftConfirmInput = z.input<typeof giftConfirmInput>;

export const wishlistClaimInput = z.object({
  guestCode: guestCodeSchema.optional(),
  name,
  clientToken,
  website: honeypot,
});

export interface PublicWish {
  id: number;
  name: string;
  message: string;
  attendance: Attendance | null;
  createdAt: string;
}

export interface WishesPage {
  items: PublicWish[];
  nextCursor: number | null;
  total: number;
}

export interface PublicGuest {
  name: string;
  maxPax: number;
  rsvp: { attendance: Attendance; pax: number; message: string } | null;
}

export interface PublicWishlistItem {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  qty: number;
  claimed: number;
  /** true when the current browser token holds a claim on this item */
  mine: boolean;
}

/* ---------------- Admin ---------------- */

export const loginInput = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(256),
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(256),
});

export const guestInput = z.object({
  name: clean(120).pipe(z.string().min(1)),
  group: clean(60).optional().default(''),
  phone: clean(30).optional().default(''),
  maxPax: z.number().int().min(1).max(20).optional(),
  notes: clean(500).optional().default(''),
});
export type GuestInput = z.input<typeof guestInput>;

export const guestImportInput = z.object({ guests: z.array(guestInput).min(1).max(2000) });

export const wishModerationInput = z.object({ status: z.enum(['visible', 'pending', 'hidden']) });
export const giftStatusInput = z.object({
  status: z.enum(['pending', 'received']),
  adminNote: clean(500).optional(),
});

export const wishlistItemInput = z.object({
  name: clean(120).pipe(z.string().min(1)),
  description: clean(500).optional().default(''),
  imageUrl: safeUrl.optional().default(''),
  link: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must be an http(s) URL')
    .optional()
    .default(''),
  qty: z.number().int().min(1).max(100),
  sort: z.number().int().min(0).max(10_000).optional().default(0),
});

export interface AdminStats {
  guests: { total: number; opened: number };
  rsvp: { yes: number; no: number; maybe: number; paxYes: number; total: number };
  wishes: { total: number; pending: number };
  gifts: { total: number; received: number; amountTotal: number };
  wishlist: { items: number; claimed: number; totalQty: number };
  opensByDay: { day: string; count: number }[];
}

export interface AdminGuest {
  id: number;
  code: string;
  name: string;
  group: string;
  phone: string;
  maxPax: number;
  notes: string;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  rsvpAttendance: Attendance | null;
  rsvpPax: number | null;
  createdAt: string;
}

export interface AdminRsvp {
  id: number;
  guestId: number | null;
  guestName: string | null;
  name: string;
  attendance: Attendance;
  pax: number;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWish extends PublicWish {
  status: 'visible' | 'pending' | 'hidden';
  guestId: number | null;
}

export interface AdminGift {
  id: number;
  guestId: number | null;
  name: string;
  method: z.infer<typeof giftMethodSchema>;
  amount: number | null;
  target: string;
  note: string;
  status: 'pending' | 'received';
  adminNote: string;
  createdAt: string;
}

export interface AdminWishlistItem {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  qty: number;
  sort: number;
  claims: { id: number; name: string; guestId: number | null; createdAt: string }[];
}

export interface MediaItem {
  id: number;
  url: string;
  kind: 'image' | 'audio';
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  originalName: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}
