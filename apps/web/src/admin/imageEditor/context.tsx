import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ImageEditor, type EditOptions } from './ImageEditor';

export type { EditOptions, FrameShape } from './ImageEditor';

/** Resolves with the file to upload (edited or original), or null when the user cancels. */
type EditFn = (file: File, opts?: EditOptions) => Promise<File | null>;

const Ctx = createContext<EditFn>((file) => Promise.resolve(file));

/** Formats the browser can decode for editing. Anything else (e.g. HEIC) uploads as-is. */
const EDITABLE = /^image\/(jpeg|png|webp|avif|gif|bmp)$/;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth && img.naturalHeight) resolve(img);
      else reject(new Error('empty image'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

type Job = {
  img: HTMLImageElement;
  file: File;
  opts: EditOptions;
  resolve: (f: File | null) => void;
  key: number;
};

export function ImageEditorProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null);

  const edit = useCallback<EditFn>(async (file, opts = {}) => {
    if (!EDITABLE.test(file.type)) return file;
    let img: HTMLImageElement;
    try {
      img = await loadImage(file);
    } catch {
      return file; // The server will still try to process it.
    }
    return new Promise<File | null>((resolve) =>
      setJob({ img, file, opts, resolve, key: Date.now() }),
    );
  }, []);

  const finish = (f: File | null) => {
    job?.resolve(f);
    setJob(null);
  };

  return (
    <Ctx.Provider value={edit}>
      {children}
      {job && (
        <ImageEditor
          key={job.key}
          img={job.img}
          file={job.file}
          options={job.opts}
          onDone={finish}
          onCancel={() => finish(null)}
        />
      )}
    </Ctx.Provider>
  );
}

export const useImageEditor = () => useContext(Ctx);

/** Fetch an already-uploaded image (same origin) so it can be edited. */
export async function fileFromUrl(url: string) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Couldn't load the image (${res.status})`);
  const blob = await res.blob();
  const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'photo');
  return new File([blob], name, { type: blob.type });
}
