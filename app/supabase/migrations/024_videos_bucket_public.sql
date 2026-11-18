-- 024_videos_bucket_public: make the `videos` storage bucket public (owner, 2026-11-18: "make the bucket public").
-- Why: the bucket was private, so every page load minted a fresh signed URL — a different URL per request, so the
-- CDN in front of Storage never had the file and every play came from the origin in Paris (~2 MB/s, measured).
-- A public bucket serves one stable URL per video at /storage/v1/object/public/videos/<path>, cached globally by
-- the CDN. Paths are unguessable (portfolio/<auth-uid>/<timestamp>.<ext>); the app builds public URLs in
-- lib/video-links.ts. Signed URLs keep working, so URLs already handed out stay valid.
-- Note: this bucket also holds connection deliverable videos — they too become reachable by their (unguessable)
-- URL. If deliverables ever need to stay private, move them to a separate private bucket.
update storage.buckets set public = true where id = 'videos';
