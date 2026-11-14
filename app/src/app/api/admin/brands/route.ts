import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ brands: [] });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("users")
    .select(`
      id, full_name, phone, is_active, avatar_url, created_at,
      brand_profiles(id, shop_name, category, categories, website_url, total_credits, used_credits, description, logo_url)
    `)
    .eq("type", "brand")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/brands] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מותגים" }, { status: 500 });
  }

  // Hearts each business sent to creators (owner, 2026-11-14): count + who (connections the brand initiated)
  const { data: heartRows, error: heartsErr } = await supabase
    .from("connections")
    .select("brand_id, status, created_at, creator_profiles!connections_creator_id_fkey(users(full_name, phone))")
    .eq("initiated_by", "brand")
    .order("created_at", { ascending: false });
  if (heartsErr) console.error("[admin/brands] hearts:", heartsErr.message);
  const heartsByBrand: Record<string, { name: string; status: string; at: string }[]> = {};
  for (const h of (heartRows || []) as any[]) {
    const user = h.creator_profiles?.users;
    const name = (user?.full_name || "").trim() || (user?.phone ? `ללא שם (${user.phone})` : "יוצר/ת");
    (heartsByBrand[h.brand_id] ||= []).push({ name, status: h.status || "pending", at: h.created_at });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brands = (data || []).map((u: any) => {
    const profile = Array.isArray(u.brand_profiles) ? u.brand_profiles[0] : u.brand_profiles;
    const hearts = profile?.id ? heartsByBrand[profile.id] || [] : [];
    return {
      hearts_sent: hearts.length,
      hearts_to: hearts,
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      is_active: u.is_active,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      shop_name: profile?.shop_name || "",
      category: profile?.category || "",
      categories: Array.isArray(profile?.categories) && profile.categories.length > 0
        ? profile.categories
        : [profile?.category].filter(Boolean),
      website_url: profile?.website_url,
      total_credits: profile?.total_credits || 0,
      used_credits: profile?.used_credits || 0,
      description: profile?.description,
      logo_url: profile?.logo_url,
    };
  });

  return NextResponse.json({ brands });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, is_active, total_credits } = body;

  if (!userId) {
    return NextResponse.json({ error: "מזהה משתמש חסר" }, { status: 400 });
  }

  if (total_credits !== undefined) {
    const credits = Number(total_credits);
    if (!Number.isInteger(credits) || credits < 0) {
      return NextResponse.json({ error: "מספר סרטונים לא תקין" }, { status: 400 });
    }
    const { error } = await (supabase
      .from("brand_profiles") as any)
      .update({ total_credits: credits })
      .eq("user_id", userId);

    if (error) {
      // brand_profiles_credits_check: total can't drop below the credits already used
      if ((error as { code?: string }).code === "23514") {
        return NextResponse.json({ error: "לא ניתן להגדיר פחות סרטונים ממה שכבר נוצל" }, { status: 400 });
      }
      console.error("[admin/brands] credits update error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון סרטונים" }, { status: 500 });
    }
  }

  if (is_active !== undefined) {
    const { error } = await (supabase
      .from("users") as any)
      .update({ is_active })
      .eq("id", userId);

    if (error) {
      console.error("[admin/brands] update error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
    }
  }

  // Admin actions are audited
  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_brand",
    entityType: "user",
    entityId: userId,
    details: {
      ...(is_active !== undefined ? { is_active } : {}),
      ...(total_credits !== undefined ? { total_credits: Number(total_credits) } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
