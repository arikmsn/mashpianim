// Product image URLs as brands paste them, turned into something an <img> can actually load (pure, unit-tested).

const DRIVE_FILE = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/;
const DRIVE_OPEN = /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/;
const DRIVE_DOWNLOAD = /drive\.usercontent\.google\.com\/download\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/;

export function driveFileId(url: string): string | null {
  const m = url.match(DRIVE_FILE) || url.match(DRIVE_OPEN) || url.match(DRIVE_DOWNLOAD);
  return m ? m[1] : null;
}

// Google Drive share links and the old `uc?export=view` form redirect to a download endpoint that browsers
// refuse to render inline; the thumbnail endpoint serves the file as a plain image (the file must be shared
// "anyone with the link"). Everything else is returned untouched.
export function toDirectImageUrl(url: string | null | undefined, width = 1200): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const id = driveFileId(trimmed);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
  return trimmed;
}
