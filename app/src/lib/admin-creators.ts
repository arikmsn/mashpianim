// Pure helpers for the admin creators screens (unit-tested): per-creator counts from raw rows, display name,
// follower formatting and a Hebrew "last seen" label. No framework imports.

export interface VideoRow {
  creator_id: string | null; // users.id
  connection_id: string | null;
  status: string | null;
}

export interface ConnectionRow {
  creator_id: string | null; // creator_profiles.id
  initiated_by: string | null;
  status: string | null;
}

export interface CreatorAgg {
  videosPortfolio: number; // portfolio videos that count (not taken down)
  videosRemoved: number; // portfolio videos taken down by an admin
  videosCollab: number; // videos uploaded inside a collaboration (a connection)
  heartsFromBrands: number; // hearts a business sent this creator
  matches: number; // connections the business confirmed (any status after pending)
}

export const EMPTY_AGG: CreatorAgg = { videosPortfolio: 0, videosRemoved: 0, videosCollab: 0, heartsFromBrands: 0, matches: 0 };

export function isMatched(status: string | null | undefined): boolean {
  return !!status && !["pending", "rejected", "cancelled"].includes(status);
}

// `profileToUser` maps creator_profiles.id → users.id (connections reference the profile, videos the user)
export function aggregateCreators(videos: VideoRow[], connections: ConnectionRow[], profileToUser: Record<string, string>): Record<string, CreatorAgg> {
  const out: Record<string, CreatorAgg> = {};
  const get = (userId: string) => (out[userId] ||= { ...EMPTY_AGG });
  for (const v of videos) {
    if (!v.creator_id) continue;
    const a = get(v.creator_id);
    if (v.connection_id) a.videosCollab += 1;
    else if (v.status === "rejected") a.videosRemoved += 1;
    else a.videosPortfolio += 1;
  }
  for (const c of connections) {
    const userId = c.creator_id ? profileToUser[c.creator_id] : undefined;
    if (!userId) continue;
    const a = get(userId);
    if (c.initiated_by === "brand") a.heartsFromBrands += 1;
    if (isMatched(c.status)) a.matches += 1;
  }
  return out;
}

export function displayName(fullName: string | null | undefined, phone: string | null | undefined): string {
  const n = (fullName || "").trim();
  if (n) return n;
  const p = (phone || "").trim();
  return p ? `ללא שם (${p})` : "ללא שם";
}

export function formatFollowers(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}

// "היום" / "אתמול" / "לפני 3 ימים" / "לפני 3 שבועות" / "לפני 2 חודשים" / "אף פעם"
export function lastSeenLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "אף פעם";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "אף פעם";
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}

// Null-safe search over name / phone. Phones are stored as +972…, admins type 058…: a leading 0 in the query
// is also tried as 972.
export function matchesSearch(row: { name?: string | null; phone?: string | null }, query: string): boolean {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  if ((row.name || "").toLowerCase().includes(q)) return true;
  const phoneDigits = (row.phone || "").replace(/\D/g, "");
  const qd = q.replace(/\D/g, "");
  if (!qd || !phoneDigits) return false;
  const alt = qd.startsWith("0") ? "972" + qd.slice(1) : qd;
  return phoneDigits.includes(qd) || phoneDigits.includes(alt);
}
