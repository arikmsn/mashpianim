import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { MIN_PORTFOLIO_VIDEOS } from "@/lib/match";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const ACTIVE_STATUSES = new Set(["pending", "approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"]);

// Creator gallery for brands: every active creator, ranked by fit to this brand.
export async function GET() {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // The gallery is a brand screen — judged by the role this session is signed in as
  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  const me = viewer ? ({ id: viewer.userId, type: viewer.role } as any) : null;
  if (!me || me.type !== "brand") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data: bp } = await admin
    .from("brand_profiles")
    .select("id, category, categories")
    .eq("user_id", me.id)
    .maybeSingle();
  const brand = bp as any;
  const brandCategories: string[] = Array.isArray(brand?.categories) && brand.categories.length > 0
    ? brand.categories
    : [brand?.category].filter(Boolean);

  const [{ data: creators }, { data: videos }, { data: relations }] = await Promise.all([
    admin
      .from("users")
      .select("id, full_name, avatar_url, created_at, creator_profiles(id, bio, city, categories, level, completed_connections, tiktok_followers, instagram_followers, tiktok_handle, instagram_handle)")
      .eq("type", "creator")
      .eq("is_active", true)
      .limit(300),
    admin
      .from("videos")
      .select("id, creator_id, storage_path, url, title, thumbnail_url, created_at")
      .is("connection_id", null)
      .order("created_at", { ascending: false })
      .limit(3000),
    brand?.id
      ? admin
          .from("connections")
          .select("id, creator_id, product_id, status, initiated_by, created_at, products(name)")
          .eq("brand_id", brand.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byCreator = new Map<string, { count: number; first: any }>();
  for (const v of (videos || []) as any[]) {
    const entry = byCreator.get(v.creator_id) || { count: 0, first: v };
    entry.count++;
    byCreator.set(v.creator_id, entry);
  }

  const relationByProfile = new Map<string, any>();
  for (const r of (relations || []) as any[]) {
    if (!ACTIVE_STATUSES.has(r.status)) continue;
    if (!relationByProfile.has(r.creator_id)) relationByProfile.set(r.creator_id, r);
  }

  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const brandCats = brandCategories.map(normalize);
  const overlaps = (cats: string[]) =>
    cats.some((c) => brandCats.some((b) => b === normalize(c) || b.startsWith(normalize(c)) || normalize(c).startsWith(b)));

  const list = await Promise.all(
    ((creators || []) as any[]).map(async (u) => {
      const cp = Array.isArray(u.creator_profiles) ? u.creator_profiles[0] : u.creator_profiles;
      const port = byCreator.get(u.id) || { count: 0, first: null };
      let previewVideo: string | null = null;
      if (port.first?.storage_path) {
        const { data } = await admin.storage.from("videos").createSignedUrl(port.first.storage_path, 86400);
        previewVideo = data?.signedUrl || port.first.url || null;
      } else if (port.first?.url) {
        previewVideo = port.first.url;
      }
      const categories: string[] = cp?.categories || [];
      const completed = cp?.completed_connections || 0;
      const followers = (cp?.tiktok_followers || 0) + (cp?.instagram_followers || 0);
      const rel = cp?.id ? relationByProfile.get(cp.id) : null;

      let score = 0;
      if (overlaps(categories)) score += 100;
      score += port.count >= MIN_PORTFOLIO_VIDEOS ? 50 : port.count * 6;
      score += Math.min(30, completed * 5);
      if (u.avatar_url) score += 5;
      if (cp?.bio) score += 3;
      if (followers > 0) score += Math.min(15, Math.log10(followers + 1) * 3);
      const ageDays = (Date.now() - new Date(u.created_at).getTime()) / 86400000;
      if (ageDays < 14) score += 4;

      return {
        userId: u.id,
        profileId: cp?.id || null,
        name: u.full_name || "יוצר/ת",
        avatar: u.avatar_url || null,
        city: cp?.city || "",
        bio: cp?.bio || "",
        categories,
        level: cp?.level || "creator",
        followers,
        tiktok: cp?.tiktok_handle || "",
        instagram: cp?.instagram_handle || "",
        completed,
        portfolioCount: port.count,
        portfolioReady: port.count >= MIN_PORTFOLIO_VIDEOS,
        previewVideo,
        previewPoster: port.first?.thumbnail_url || null,
        previewTitle: port.first?.title || null,
        relation: rel
          ? { connectionId: rel.id, status: rel.status, initiatedBy: rel.initiated_by || "creator", productId: rel.product_id, productName: rel.products?.name || "" }
          : null,
        fit: overlaps(categories),
        score,
      };
    })
  );

  list.sort((a, b) => b.score - a.score);
  return NextResponse.json({ creators: list, brandCategories });
}
