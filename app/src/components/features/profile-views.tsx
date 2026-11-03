"use client";

import { useEffect, useState } from "react";
import { Avatar, Badge, Modal } from "@/components/ui";

export interface CreatorPublicProfile {
  userId: string;
  name: string;
  avatar: string | null;
  bio: string;
  city: string;
  categories: string[];
  level: string;
  hearts: number;
  tiktok: string;
  tiktokFollowers: number;
  instagram: string;
  instagramFollowers: number;
  introVideo: string | null;
  memberSince: string;
  portfolio: { id: string; title: string | null; description: string | null; url: string | null; thumbnail?: string | null; status: string; createdAt: string }[];
  stats: { completed: number; active: number; portfolioCount: number };
}

export interface BrandPublicProfile {
  userId: string;
  name: string;
  contactName: string;
  avatar: string | null;
  category: string;
  categories: string[];
  description: string;
  website: string;
  memberSince: string;
  products: { id: string; name: string; image_url: string | null; price: number; product_type: string }[];
  stats: { activeProducts: number; completed: number; active: number };
}

type PublicProfile =
  | { type: "creator"; profile: CreatorPublicProfile }
  | { type: "brand"; profile: BrandPublicProfile };

const levelLabels: Record<string, string> = {
  creator: "יוצר/ת",
  creator_plus: "יוצר/ת+",
  on_the_radar: "על הרדאר",
};

function formatFollowers(n: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function memberSinceLabel(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function cleanHandle(h: string) {
  return h.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(tiktok\.com\/@?|instagram\.com\/)/, "").replace(/\/.*$/, "");
}

function StatBox({ value, label, tone = "neutral" }: { value: number | string; label: string; tone?: "neutral" | "pink" | "emerald" }) {
  const bg = tone === "pink" ? "bg-pink-50 text-pink-600" : tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-50 text-neutral-900";
  return (
    <div className={`text-center p-3 rounded-xl ${bg}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}

export function usePublicProfile(userId: string | null | undefined) {
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<{ userId: string; message: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/profiles/${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "שגיאה בטעינת הפרופיל");
        return res.json();
      })
      .then((json) => { if (!cancelled) { setData(json); setError(null); } })
      .catch((e) => { if (!cancelled) setError({ userId, message: e.message }); });
    return () => { cancelled = true; };
  }, [userId]);

  const current = data && data.profile.userId === userId ? data : null;
  const currentError = error && error.userId === userId ? error.message : null;
  return { data: current, loading: !!userId && !current && !currentError, error: currentError };
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-pink-100" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-neutral-200 rounded-lg w-40" />
          <div className="h-3 bg-neutral-100 rounded-lg w-24" />
          <div className="h-3 bg-neutral-100 rounded-lg w-56" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-neutral-100" />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map((i) => <div key={i} className="aspect-[9/16] max-h-48 rounded-xl bg-neutral-100" />)}
      </div>
    </div>
  );
}

export function CreatorProfileView({ profile, compact = false }: { profile: CreatorPublicProfile; compact?: boolean }) {
  const tiktok = cleanHandle(profile.tiktok || "");
  const instagram = cleanHandle(profile.instagram || "");
  const tf = formatFollowers(profile.tiktokFollowers);
  const inf = formatFollowers(profile.instagramFollowers);
  // The portfolio grid shows posters only; one video plays at a time in a modal (no <video> in lists)
  const [playing, setPlaying] = useState<CreatorPublicProfile["portfolio"][number] | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar src={profile.avatar} name={profile.name} size="xl" expandable />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold truncate">{profile.name}</h3>
            <Badge variant="pink" size="sm">{levelLabels[profile.level] || profile.level}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1 flex-wrap">
            {profile.city && <span>📍 {profile.city}</span>}
            <span>💖 {profile.hearts} לבבות</span>
            {profile.memberSince && <span>חבר/ה מ-{memberSinceLabel(profile.memberSince)}</span>}
          </div>
          {profile.categories.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              {profile.categories.map((cat) => (
                <Badge key={cat} variant="default" size="sm">{cat}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="text-sm text-neutral-700 bg-neutral-50 rounded-xl p-3 whitespace-pre-line">{profile.bio}</p>
      )}

      {/* Socials */}
      {(tiktok || instagram) && (
        <div className="grid grid-cols-2 gap-2">
          {tiktok && (
            <a
              href={`https://www.tiktok.com/@${tiktok}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-pink-300 hover:bg-pink-50/40 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-xs font-bold">TT</span>
              <div className="min-w-0" dir="ltr">
                <p className="text-sm font-medium truncate">@{tiktok}</p>
                {tf && <p className="text-[11px] text-neutral-500">{tf} עוקבים</p>}
              </div>
            </a>
          )}
          {instagram && (
            <a
              href={`https://www.instagram.com/${instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-pink-300 hover:bg-pink-50/40 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg ig-gradient-bg text-white flex items-center justify-center text-xs font-bold">IG</span>
              <div className="min-w-0" dir="ltr">
                <p className="text-sm font-medium truncate">@{instagram}</p>
                {inf && <p className="text-[11px] text-neutral-500">{inf} עוקבים</p>}
              </div>
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox value={profile.stats.completed} label="שיתופי פעולה שהושלמו" tone="emerald" />
        <StatBox value={profile.stats.active} label="פעילים כעת" />
        <StatBox value={profile.stats.portfolioCount} label="סרטונים בתיק" tone="pink" />
      </div>

      {/* Intro video */}
      {profile.introVideo && !compact && (
        <div>
          <p className="text-sm font-medium text-neutral-700 mb-2">🎥 סרטון היכרות</p>
          <video src={profile.introVideo} className="w-full rounded-xl max-h-64 bg-black" controls preload="metadata" controlsList="nodownload" />
        </div>
      )}

      {/* Portfolio */}
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">
          🎬 תיק עבודות
          {profile.portfolio.length > 0 && <span className="text-neutral-400 font-normal"> ({profile.portfolio.length})</span>}
        </p>
        {profile.portfolio.length === 0 ? (
          <p className="text-sm text-neutral-400 bg-neutral-50 rounded-xl p-3 text-center">
            עדיין אין סרטונים בתיק העבודות
          </p>
        ) : (
          <div className={`grid grid-cols-2 gap-2 ${compact ? "max-h-[260px]" : "max-h-[460px]"} overflow-y-auto`}>
            {profile.portfolio.map((video, i) => (
              <div key={video.id} className="rounded-xl overflow-hidden bg-black">
                {video.url ? (
                  <button
                    type="button"
                    onClick={() => setPlaying(video)}
                    aria-label={`ניגון ${video.title || "סרטון"}`}
                    className={`relative block w-full aspect-[9/16] max-h-52 bg-gradient-to-br ${posterGradients[i % posterGradients.length]}`}
                  >
                    {video.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full bg-white/90 text-pink-500 flex items-center justify-center shadow-lg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="w-full aspect-[9/16] max-h-52 flex items-center justify-center text-neutral-400 text-xs">לא זמין</div>
                )}
                {(video.title || video.description) && (
                  <div className="px-2 py-1.5">
                    {video.title && <p className="text-xs text-white/90 truncate">{video.title}</p>}
                    {video.description && <p className="text-[11px] text-white/60 line-clamp-2">{video.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title || "סרטון מתיק העבודות"} size="lg">
        {playing?.url && (
          <video
            key={playing.id}
            src={playing.url}
            poster={playing.thumbnail || undefined}
            className="w-full rounded-xl bg-black max-h-[70vh]"
            controls
            autoPlay
            playsInline
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
      </Modal>
    </div>
  );
}

// Poster backgrounds for portfolio videos uploaded before thumbnails existed
const posterGradients = [
  "from-pink-400 to-orange-300",
  "from-purple-400 to-pink-400",
  "from-emerald-400 to-teal-300",
  "from-amber-400 to-orange-300",
  "from-sky-400 to-indigo-300",
];

export function BrandProfileView({ profile, compact = false }: { profile: BrandPublicProfile; compact?: boolean }) {
  const site = profile.website ? profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const siteHref = profile.website ? (profile.website.startsWith("http") ? profile.website : `https://${profile.website}`) : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Avatar src={profile.avatar} name={profile.name} size="xl" expandable />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate">{profile.name}</h3>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {(profile.categories?.length ? profile.categories : [profile.category].filter(Boolean)).map((cat) => (
              <Badge key={cat} variant="pink" size="sm">{cat}</Badge>
            ))}
            {profile.memberSince && <span className="text-xs text-neutral-500">בפלטפורמה מ-{memberSinceLabel(profile.memberSince)}</span>}
          </div>
          {siteHref && (
            <a href={siteHref} target="_blank" rel="noopener noreferrer" className="text-sm text-pink-500 hover:underline mt-1 inline-block truncate max-w-full" dir="ltr">
              🔗 {site}
            </a>
          )}
        </div>
      </div>

      {profile.description && (
        <p className="text-sm text-neutral-700 bg-neutral-50 rounded-xl p-3 whitespace-pre-line">{profile.description}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatBox value={profile.stats.completed} label="שיתופי פעולה שהושלמו" tone="emerald" />
        <StatBox value={profile.stats.active} label="פעילים כעת" />
        <StatBox value={profile.stats.activeProducts} label="מוצרים פעילים" tone="pink" />
      </div>

      {profile.products.length > 0 && (
        <div>
          <p className="text-sm font-medium text-neutral-700 mb-2">📦 מוצרים פעילים</p>
          <div className={`grid grid-cols-3 gap-2 ${compact ? "max-h-[200px]" : "max-h-[360px]"} overflow-y-auto`}>
            {profile.products.map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden border border-neutral-100 bg-white">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-pink-100 to-pink-50 flex items-center justify-center text-2xl">
                    {p.product_type === "digital" ? "📱" : "📦"}
                  </div>
                )}
                <div className="p-1.5">
                  <p className="text-[11px] font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-pink-500">₪{Number(p.price) || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PublicProfileContent({ userId, compact = false }: { userId: string | null | undefined; compact?: boolean }) {
  const { data, loading, error } = usePublicProfile(userId);
  if (!userId) return null;
  if (loading) return <ProfileSkeleton />;
  if (error || !data) {
    return <p className="text-sm text-neutral-400 bg-neutral-50 rounded-xl p-3 text-center">{error || "לא ניתן לטעון את הפרופיל"}</p>;
  }
  return data.type === "creator"
    ? <CreatorProfileView profile={data.profile} compact={compact} />
    : <BrandProfileView profile={data.profile} compact={compact} />;
}

export function ProfileModal({ userId, onClose, title }: { userId: string | null; onClose: () => void; title?: string }) {
  return (
    <Modal open={!!userId} onClose={onClose} title={title || "פרופיל"} size="md" className="max-h-[90vh] overflow-y-auto">
      <PublicProfileContent userId={userId} />
    </Modal>
  );
}
