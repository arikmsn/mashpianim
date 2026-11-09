import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { brandRevealedToCreator } from "@/lib/connection-flow";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const ACTIVE_STATUSES = ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"];

// Public-facing profile of a creator or brand. Never exposes phone/email.
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const asSide = request.nextUrl.searchParams.get("as");

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, type, full_name, avatar_url, created_at, is_active")
    .eq("id", userId)
    .single();

  const t = target as any;
  if (!t) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // Which side of the account is asked for: a brand account, or any account with a brand profile when `?as=brand`
  const { data: bpRow } = await supabase
    .from("brand_profiles")
    .select("id, shop_name, logo_url, category, categories, website_url, description, region")
    .eq("user_id", t.id)
    .maybeSingle();
  const showBrand = !!bpRow && (t.type === "brand" || asSide === "brand") && asSide !== "creator";

  if (showBrand) {
    const profile = bpRow as any;

    // A creator sees who the business is only once that business chose her (heart first / heart back / match)
    const viewer = await resolveViewer(supabase, user.id, await readActiveRole());
    if (viewer?.role === "creator" && viewer.userId !== t.id) {
      let allowed = false;
      if (viewer.creatorProfileId) {
        const { data: rels } = await supabase
          .from("connections")
          .select("status, initiated_by, mutual_at, approved_at")
          .eq("creator_id", viewer.creatorProfileId)
          .eq("brand_id", profile.id);
        allowed = ((rels || []) as any[]).some((c) => brandRevealedToCreator(c));
      }
      if (!allowed) {
        return NextResponse.json({ error: "פרטי העסק ייחשפו אחרי שהעסק יסמן אותך בחזרה", code: "brand_hidden" }, { status: 403 });
      }
    }

    let products: any[] = [];
    let completed = 0;
    let active = 0;
    if (profile?.id) {
      const [{ data: prods }, { data: conns }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, image_url, price, product_type, status")
          .eq("brand_id", profile.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("connections").select("status").eq("brand_id", profile.id),
      ]);
      products = prods || [];
      for (const c of (conns || []) as any[]) {
        if (c.status === "completed") completed++;
        else if (ACTIVE_STATUSES.includes(c.status)) active++;
      }
    }

    return NextResponse.json({
      type: "brand",
      profile: {
        userId: t.id,
        name: profile?.shop_name || t.full_name || "עסק",
        contactName: t.full_name || "",
        avatar: profile?.logo_url || t.avatar_url || null,
        category: profile?.category || "",
        categories: Array.isArray(profile?.categories) && profile.categories.length > 0
          ? profile.categories
          : [profile?.category].filter(Boolean),
        description: profile?.description || "",
        website: profile?.website_url || "",
        region: profile?.region || "",
        memberSince: t.created_at,
        products,
        stats: { activeProducts: products.length, completed, active },
      },
    });
  }

  // creator (or admin acting as creator)
  const { data: cp } = await supabase
    .from("creator_profiles")
    .select("id, bio, city, categories, level, hearts, completed_connections, tiktok_followers, instagram_followers, intro_video_url")
    .eq("user_id", t.id)
    .single();
  const profile = cp as any;

  const [{ data: videos }, { data: conns }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, description, storage_path, url, thumbnail_url, status, created_at")
      .eq("creator_id", t.id)
      .is("connection_id", null)
      .neq("status", "rejected")
      .order("created_at", { ascending: false }),
    profile?.id
      ? supabase.from("connections").select("status").eq("creator_id", profile.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  let completed = 0;
  let active = 0;
  for (const c of (conns || []) as any[]) {
    if (c.status === "completed") completed++;
    else if (ACTIVE_STATUSES.includes(c.status)) active++;
  }

  const portfolio = await Promise.all(
    ((videos || []) as any[]).map(async (v) => {
      let url = v.url;
      if (v.storage_path) {
        const { data } = await supabase.storage.from("videos").createSignedUrl(v.storage_path, 86400);
        url = data?.signedUrl || url;
      }
      return { id: v.id, title: v.title, description: v.description, url, thumbnail: v.thumbnail_url, status: v.status, createdAt: v.created_at };
    })
  );

  return NextResponse.json({
    type: "creator",
    profile: {
      userId: t.id,
      name: t.full_name || "יוצר/ת",
      avatar: t.avatar_url || null,
      bio: profile?.bio || "",
      city: profile?.city || "",
      categories: profile?.categories || [],
      level: profile?.level || "creator",
      hearts: profile?.hearts || 0,
      // Reach only, never the account (owner, 2026-11-09): a business must not be able to reach the creator
      // outside the platform. The handles stay in the creator's own /api/profile for editing.
      tiktok: "",
      tiktokFollowers: profile?.tiktok_followers || 0,
      instagram: "",
      instagramFollowers: profile?.instagram_followers || 0,
      introVideo: profile?.intro_video_url || null,
      memberSince: t.created_at,
      portfolio,
      stats: { completed: Math.max(completed, profile?.completed_connections || 0), active, portfolioCount: portfolio.length },
    },
  });
}
