// What other users may learn about a creator's social reach (pure, unit-tested).
// The owner's rule (2026-11-09): businesses see how many followers a creator has, never which account —
// contact happens inside the platform. Handles stay in the creator's own profile for editing.

export type SocialPlatform = "tiktok" | "instagram";

export interface SocialReach {
  platform: SocialPlatform;
  name: string;
  label: string;
}

// 850 → "850", 12_300 → "12.3K", 1_200_000 → "1.2M"; nothing for 0 / unknown
export function formatFollowersCount(value: unknown): string {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${trimZero((n / 1_000).toFixed(1))}K`;
  return String(Math.floor(n));
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// The chips a public profile shows: one per platform the creator is on, with the follower count when known.
// Never the handle, never a link.
export function socialReach(profile: {
  tiktok?: string | null;
  tiktokFollowers?: number | null;
  instagram?: string | null;
  instagramFollowers?: number | null;
}): SocialReach[] {
  const out: SocialReach[] = [];
  const platforms: { platform: SocialPlatform; name: string; handle: unknown; followers: unknown }[] = [
    { platform: "tiktok", name: "TikTok", handle: profile.tiktok, followers: profile.tiktokFollowers },
    { platform: "instagram", name: "Instagram", handle: profile.instagram, followers: profile.instagramFollowers },
  ];
  for (const p of platforms) {
    const count = formatFollowersCount(p.followers);
    const present = !!count || (typeof p.handle === "string" && p.handle.trim().length > 0);
    if (!present) continue;
    out.push({ platform: p.platform, name: p.name, label: count ? `${count} עוקבים` : "פעיל/ה ברשת" });
  }
  return out;
}
