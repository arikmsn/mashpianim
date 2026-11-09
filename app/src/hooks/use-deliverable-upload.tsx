"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { generateVideoThumbnail } from "@/lib/video-thumbnail";
import { uploadToStorage } from "@/lib/storage-upload";
import { videoFileProblem } from "@/lib/uploads";

// Uploads a creator's deliverable for a connection: straight to Storage (with progress) under the user's own
// folder, then `POST /api/videos/save-connection` records it. Shared by the product page and the connections list.
export function useDeliverableUpload(onUploaded: (connectionId: string) => void) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // Several files in one go (owner, 2026-11-09): "2/3" while they upload one after the other
  const [fileIndex, setFileIndex] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const start = useCallback((connectionId: string) => {
    targetRef.current = connectionId;
    inputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const connectionId = targetRef.current;
      e.target.value = "";
      if (files.length === 0 || !connectionId) return;

      for (const file of files) {
        const problem = videoFileProblem(file);
        if (problem) {
          toast(files.length > 1 ? `${file.name}: ${problem}` : problem, "error");
          return;
        }
      }
      if (!user) {
        toast("יש להתחבר מחדש", "error");
        return;
      }

      setUploadingId(connectionId);
      setProgress(0);
      setFileIndex({ current: 1, total: files.length });
      let saved = 0;
      try {
        const supabase = createClient();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setFileIndex({ current: i + 1, total: files.length });
          setProgress(0);
          const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
          const base = `portfolio/${user.id}/connections/${connectionId}/${Date.now()}-${i + 1}`;
          const storagePath = `${base}.${ext}`;
          const thumbPath = `${base}.jpg`;

          const [uploadResult, thumbBlob] = await Promise.all([
            uploadToStorage({
              bucket: "videos",
              path: storagePath,
              file,
              contentType: file.type || "video/mp4",
              onProgress: setProgress,
            }),
            generateVideoThumbnail(file),
          ]);

          if (!uploadResult.ok) {
            toast(uploadResult.error, "error");
            break;
          }

          let thumbnailPath: string | null = null;
          if (thumbBlob) {
            const { error: thumbError } = await supabase.storage
              .from("thumbnails")
              .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: true });
            if (!thumbError) thumbnailPath = thumbPath;
          }

          const res = await fetch("/api/videos/save-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, storagePath, thumbnailPath }),
          });
          if (res.ok) {
            saved++;
            onUploaded(connectionId);
          } else {
            const data = await res.json().catch(() => ({}));
            toast((data as { error?: string }).error || "שגיאה בהעלאת הסרטון", "error");
            break;
          }
        }
        if (saved > 0) toast(saved > 1 ? `${saved} סרטונים הועלו בהצלחה! 🎬` : "הסרטון הועלה בהצלחה! 🎬", "success");
      } catch {
        toast("שגיאה בהעלאת הסרטון", "error");
      } finally {
        setUploadingId(null);
        setProgress(0);
        setFileIndex(null);
      }
    },
    [user, toast, onUploaded]
  );

  const input = (
    <input ref={inputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleFileSelected} />
  );

  // Label for the upload button while files are in flight
  const buttonLabel = (connectionId: string, idle: string) => {
    if (uploadingId !== connectionId) return idle;
    const which = fileIndex && fileIndex.total > 1 ? `סרטון ${fileIndex.current}/${fileIndex.total}` : "סרטון";
    return progress < 100 ? `מעלה ${which}... ${progress}%` : "שומר...";
  };

  return { uploadingId, progress, start, input, buttonLabel };
}
