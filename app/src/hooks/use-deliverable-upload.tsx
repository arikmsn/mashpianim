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
      const file = e.target.files?.[0];
      const connectionId = targetRef.current;
      e.target.value = "";
      if (!file || !connectionId) return;

      const problem = videoFileProblem(file);
      if (problem) {
        toast(problem, "error");
        return;
      }
      if (!user) {
        toast("יש להתחבר מחדש", "error");
        return;
      }

      setUploadingId(connectionId);
      setProgress(0);
      try {
        const supabase = createClient();
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        const base = `portfolio/${user.id}/connections/${connectionId}/${Date.now()}`;
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
          return;
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
          toast("הסרטון הועלה בהצלחה! 🎬", "success");
          onUploaded(connectionId);
        } else {
          const data = await res.json().catch(() => ({}));
          toast((data as { error?: string }).error || "שגיאה בהעלאת הסרטון", "error");
        }
      } catch {
        toast("שגיאה בהעלאת הסרטון", "error");
      } finally {
        setUploadingId(null);
        setProgress(0);
      }
    },
    [user, toast, onUploaded]
  );

  const input = (
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} />
  );

  // Label for the upload button while a file is in flight
  const buttonLabel = (connectionId: string, idle: string) =>
    uploadingId === connectionId ? (progress < 100 ? `מעלה סרטון... ${progress}%` : "שומר...") : idle;

  return { uploadingId, progress, start, input, buttonLabel };
}
