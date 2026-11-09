import { fileTypeFromBuffer } from 'file-type';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import sharp from 'sharp';
import type { MediaItem } from '@sakinah/shared';
import type { Db } from '../db/index.js';
import { media } from '../db/schema.js';
import { HttpError } from '../http.js';

sharp.cache(false);
sharp.concurrency(1);

const randomName = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);
export const MEDIA_FILENAME_RE = /^[0-9a-z]{24}\.(webp|mp3|ogg|m4a|wav)$/;

const AUDIO: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'video/mp4': 'm4a', // some .m4a files sniff as mp4 container; we only ever serve as audio/mp4
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
};
const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']);

export const EXT_MIME: Record<string, string> = {
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

const toItem = (r: typeof media.$inferSelect): MediaItem => ({
  id: r.id,
  url: `/media/${r.filename}`,
  kind: r.kind,
  mime: r.mime,
  size: r.size,
  width: r.width,
  height: r.height,
  originalName: r.originalName,
  createdAt: r.createdAt,
});

export class MediaService {
  readonly dir: string;

  constructor(
    private readonly db: Db,
    dir: string,
  ) {
    // res.sendFile requires an absolute path.
    this.dir = resolve(dir);
    mkdirSync(this.dir, { recursive: true });
  }

  list(): MediaItem[] {
    return this.db.select().from(media).orderBy(desc(media.id)).all().map(toItem);
  }

  /**
   * Validate by magic bytes (never trust the client's MIME/extension).
   * Images are re-encoded to WebP (strips EXIF/GPS and any embedded payloads).
   */
  async save(buf: Buffer, originalName: string): Promise<MediaItem> {
    const ft = await fileTypeFromBuffer(buf);
    if (!ft) throw new HttpError(415, 'Unrecognised file type');

    let out: Buffer;
    let ext: string;
    let kind: 'image' | 'audio';
    let width: number | null = null;
    let height: number | null = null;

    if (IMAGE.has(ft.mime)) {
      kind = 'image';
      ext = 'webp';
      try {
        const img = sharp(buf, { limitInputPixels: 60_000_000, animated: false, failOn: 'error' })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true });
        const { data, info } = await img.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
        out = data;
        width = info.width;
        height = info.height;
      } catch {
        throw new HttpError(415, 'Image could not be processed');
      }
    } else if (AUDIO[ft.mime]) {
      kind = 'audio';
      ext = AUDIO[ft.mime]!;
      out = buf;
    } else {
      throw new HttpError(415, `Unsupported file type: ${ft.mime}`);
    }

    const filename = `${randomName()}.${ext}`;
    await writeFile(join(this.dir, filename), out, { flag: 'wx', mode: 0o640 });
    const safeOriginal = originalName.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const row = this.db
      .insert(media)
      .values({ filename, kind, mime: EXT_MIME[ext]!, size: out.length, width, height, originalName: safeOriginal })
      .returning()
      .get();
    return toItem(row);
  }

  async remove(id: number): Promise<boolean> {
    const row = this.db.select().from(media).where(eq(media.id, id)).get();
    if (!row) return false;
    this.db.delete(media).where(eq(media.id, id)).run();
    await unlink(join(this.dir, row.filename)).catch(() => undefined);
    return true;
  }
}
