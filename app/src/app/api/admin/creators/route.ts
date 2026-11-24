import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { aggregateCreators, EMPTY_AGG, type ConnectionRow, type VideoRow } from "@/lib/admin-creators";

// Admin list of creators (owner list, 2026-11-14): name, followers, the real status, portfolio / collaboration
// video counts, hearts received from businesses, matches, last activity. Admin-flagged creators (users.is_admin)
// stay listed because their type is still "creator".
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ creators: [] });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      creator_profiles(id, level, categories, tiktok_handle, instagram_handle, tiktok_followers, instagram_followers, city, bio)
    `)
    .eq("type", "creator")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/creators] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת יוצרים" }, { status: 500 });
  }

  const rows = (data || []) as any[];
  const profileOf = (u: any) => (Array.isArray(u.creator_profiles) ? u.creator_profiles[0] : u.creator_profiles);
  const profileToUser: Record<string, string> = {};
  for (const u of rows) {
    const p = profileOf(u);
    if (p?.id) profileToUser[p.id] = u.id;
  }

  // Counts come from the raw rows (a few hundred at most today); videos reference users.id, connections the profile
  const [videosRes, connsRes] = await Promise.all([
    supabase.from("videos").select("creator_id, connection_id, status"),
    supabase.from("connections").select("creator_id, initiated_by, status"),
  ]);
  if (videosRes.error) console.error("[admin/creators] videos:", videosRes.error.message);
  if (connsRes.error) console.error("[admin/creators] connections:", connsRes.error.message);
  const agg = aggregateCreators((videosRes.data || []) as VideoRow[], (connsRes.data || []) as ConnectionRow[], profileToUser);
  // Creators who already hold a business account on the same phone (the admin opened it, they registered it)
  const { data: brandRows } = await supabase.from("brand_profiles").select("user_id");
  const brandUsers = new Set(((brandRows || []) as { user_id: string }[]).map((b) => b.user_id));

  const creators = rows.map((u) => {
    const profile = profileOf(u);
    const a = agg[u.id] || EMPTY_AGG;
    return {
      id: u.id,
      name: u.full_name || "",
      phone: u.phone || "",
      is_active: u.is_active !== false,
      is_admin: u.is_admin === true,
      // The admin opened the business side for this creator (022); has_brand_profile = they already registered it
      dual_role_allowed: u.dual_role_allowed === true,
      has_brand_profile: brandUsers.has(u.id),
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      last_seen_at: u.last_seen_at || null,
      // Completed sign-ins (027): the latest and the one before it
      last_login_at: u.last_login_at || null,
      previous_login_at: u.previous_login_at || null,
      level: profile?.level || "creator",
      categories: Array.isArray(profile?.categories) ? profile.categories : [],
      city: profile?.city || null,
      bio: profile?.bio || null,
      tiktok_handle: profile?.tiktok_handle || null,
      instagram_handle: profile?.instagram_handle || null,
      tiktok_followers: Number(profile?.tiktok_followers) || 0,
      instagram_followers: Number(profile?.instagram_followers) || 0,
      videos_portfolio: a.videosPortfolio,
      videos_removed: a.videosRemoved,
      videos_collab: a.videosCollab,
      hearts_from_brands: a.heartsFromBrands,
      matches: a.matches,
    };
  });

  return NextResponse.json({ creators });
}

// Suspend / reactivate (users.is_active — a suspended account cannot sign in and open sessions see a gate),
// or change the level. Accepts `is_active` or `action: "suspend" | "activate"`.
export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: string; is_active?: unknown; action?: unknown; level?: unknown; dual_role_allowed?: unknown };
  const dualRole: boolean | undefined = typeof body.dual_role_allowed === "boolean" ? body.dual_role_allowed : undefined;
  const { userId, level } = body;
  let isActive: boolean | undefined = typeof body.is_active === "boolean" ? body.is_active : undefined;
  if (isActive === undefined && (body.action === "suspend" || body.action === "activate")) isActive = body.action === "activate";

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "חסר userId" }, { status: 400 });
  }
  if (isActive === undefined && level === undefined && dualRole === undefined) {
    return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });
  }

  if (isActive !== undefined) {
    const { error } = await supabase.from("users").update({ is_active: isActive } as any).eq("id", userId);
    if (error) {
      console.error("[admin/creators] update user error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
    }
  }
  if (typeof level === "string" && level) {
    const { error } = await supabase.from("creator_profiles").update({ level } as any).eq("user_id", userId);
    if (error) {
      console.error("[admin/creators] update level error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון הרמה" }, { status: 500 });
    }
  }

  // The business side for this creator (owner, 2026-11-16): the profile then offers "הוספת חשבון עסק"
  if (dualRole !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ dual_role_allowed: dualRole, dual_role_allowed_at: dualRole ? new Date().toISOString() : null } as any)
      .eq("id", userId);
    if (error) {
      console.error("[admin/creators] dual role update error:", error);
      return NextResponse.json({ error: /dual_role_allowed/.test(error.message) ? "המיגרציה 022 עדיין לא הופעלה" : "שגיאה בעדכון" }, { status: 500 });
    }
    if (dualRole) {
      await createNotification({
        userId,
        type: "dual_role_allowed",
        title: "🏪 נפתחה לכם האפשרות לחשבון עסק",
        body: "בפרופיל מופיע עכשיו \"הוספת חשבון עסק\" — אותו מספר טלפון, שני ממשקים, מעבר ביניהם מהפרופיל.",
        data: { role: "creator" },
      });
    }
  }

  // Admin actions are audited
  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_creator",
    entityType: "user",
    entityId: userId,
    details: { ...(isActive !== undefined ? { is_active: isActive } : {}), ...(typeof level === "string" ? { level } : {}), ...(dualRole !== undefined ? { dual_role_allowed: dualRole } : {}) },
  });

  return NextResponse.json({ success: true, is_active: isActive });
}
