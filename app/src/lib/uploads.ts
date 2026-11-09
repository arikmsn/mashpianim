// Upload limits and content checks shared by the browser (pre-flight) and the API routes (enforcement).
// No framework imports so it can be unit-tested.
//
// MAX_VIDEO_MB is the limit users see. It must never exceed what Storage actually accepts:
//   * Supabase Free plan: 50 MB per file (hard cap, regardless of bucket settings)
//   * Supabase Pro: the project-wide upload limit set in Dashboard → Storage → Settings
// The `videos` bucket is already configured for 150 MB (migration 009); after upgrading to Pro and raising
// the project limit, set this to 150 (≈ 2 minutes of 1080p phone video).

// 2026-11-10 01:20: Supabase Pro + the project-wide Storage limit raised to 150 MB by the owner (a 51 MB probe
// upload was accepted); the `videos` bucket allows 150 MB too (migration 009). About 2 minutes of 1080p.
export const MAX_VIDEO_MB = 150;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
export const MAX_IMAGE_MB = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"] as const;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1);
}

// Browsers sometimes report an empty type; Storage then validates the content-type we send instead.
export function isAllowedVideoType(type: unknown): boolean {
  if (typeof type !== "string" || type === "") return true;
  return (VIDEO_MIME_TYPES as readonly string[]).includes(type.toLowerCase());
}

// Hebrew message explaining why a video can't be uploaded, or null when it can.
export function videoFileProblem(file: { size: number; type: string }): string | null {
  if (!isAllowedVideoType(file.type)) {
    return "פורמט הסרטון לא נתמך. העלו MP4, MOV או WebM.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `הסרטון גדול מדי (${formatMb(file.size)}MB). הגודל המקסימלי כרגע הוא ${MAX_VIDEO_MB}MB. קצרו את הסרטון או הורידו את הרזולוציה (720p מספיק).`;
  }
  return null;
}

// Identifies an image by its magic bytes (client-provided MIME types and file names are not trusted)
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionForImage(mime: ImageMime): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

// Maps a failed direct-to-Storage upload to a message the user can act on
export function storageUploadErrorMessage(status: number, body: string): string {
  const text = (body || "").toLowerCase();
  if (status === 413 || text.includes("payload too large") || text.includes("maximum allowed size") || text.includes("exceeded")) {
    return `הקובץ גדול מהמותר. הגודל המקסימלי הוא ${MAX_VIDEO_MB}MB.`;
  }
  if (status === 415 || text.includes("mime type") || text.includes("not supported")) {
    return "פורמט הקובץ לא נתמך. העלו MP4, MOV או WebM.";
  }
  if (status === 401 || status === 403) {
    return "ההרשאה פגה. התחברו מחדש ונסו שוב.";
  }
  if (status === 409 || text.includes("already exists")) {
    return "קובץ בשם זה כבר קיים. נסו שוב.";
  }
  return "שגיאה בהעלאת הקובץ. נסו שוב.";
}
