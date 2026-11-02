"use client";

// Grabs a frame from a local video file and returns it as a JPEG blob (poster image).
// Best effort: resolves null if the browser can't decode the file.
export function generateVideoThumbnail(file: File, maxWidth = 540): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;

    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 10000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1.5, Math.max(0.1, video.duration * 0.1))
        : 0.1;
      try {
        video.currentTime = target;
      } catch {
        finish(null);
      }
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, maxWidth / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.82);
      } catch {
        finish(null);
      }
    };

    video.src = url;
    video.load();
  });
}
