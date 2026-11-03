"use client";

// Direct browser → Supabase Storage upload with progress events.
// supabase-js's upload() has no progress callback, so this talks to the Storage REST endpoint with an
// XMLHttpRequest using the current session's access token. Bucket policies and limits still apply.

import { createClient } from "@/lib/supabase/client";
import { storageUploadErrorMessage } from "@/lib/uploads";

export interface UploadOptions {
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  upsert?: boolean;
  onProgress?: (percent: number) => void;
}

export type UploadResult = { ok: true } | { ok: false; error: string };

export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const url = process.env.NEXT_SUPABASE_URL;
  const anonKey = process.env.NEXT_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, error: "האחסון לא מוגדר" };

  const { data: { session } } = await createClient().auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "ההרשאה פגה. התחברו מחדש ונסו שוב." };

  const objectUrl = `${url}/storage/v1/object/${opts.bucket}/${opts.path.split("/").map(encodeURIComponent).join("/")}`;

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", objectUrl);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("content-type", opts.contentType);
    xhr.setRequestHeader("x-upsert", opts.upsert ? "true" : "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "החיבור נכשל במהלך ההעלאה. בדקו את החיבור לאינטרנט ונסו שוב." });
    xhr.ontimeout = () => resolve({ ok: false, error: "ההעלאה נמשכה יותר מדי זמן. נסו שוב." });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: storageUploadErrorMessage(xhr.status, xhr.responseText) });
      }
    };
    xhr.send(opts.file);
  });
}
