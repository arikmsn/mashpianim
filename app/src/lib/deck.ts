// The business's creator deck plays a creator's portfolio as a short playlist (owner, 2026-11-23: "run all
// her videos in a loop, so the business sees her range without opening the profile"). Pure helpers, unit-tested;
// the API builds the list, the card advances through it.

export const MAX_DECK_PREVIEWS = 6;

export interface DeckPreview {
  url: string;
  poster: string | null;
}

// Newest first, at most MAX_DECK_PREVIEWS, only videos that have a playable URL
export function previewsFromVideos<T extends { url: string | null; poster: string | null; createdAt: string }>(videos: T[], max = MAX_DECK_PREVIEWS): DeckPreview[] {
  return [...videos]
    .filter((v) => typeof v.url === "string" && v.url.length > 0)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, max)
    .map((v) => ({ url: v.url as string, poster: v.poster }));
}

// After a video ends: the next one, wrapping around; a single video stays at 0
export function nextPreviewIndex(current: number, count: number): number {
  if (count <= 1) return 0;
  return (current + 1) % count;
}
