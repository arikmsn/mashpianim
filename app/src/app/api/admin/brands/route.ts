import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";

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
      *,
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

  // Orders through SUMIT (021), newest first — pending, paid, failed
  const { data: txRows, error: txErr } = await supabase
    .from("transactions")
    .select("id, brand_id, amount, credits, status, created_at, payment_method, payment_ref")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (txErr) console.error("[admin/brands] transactions:", txErr.message);
  const purchasesByBrand: Record<string, { id: string; amount: number; credits: number; status: string; at: string; method: string; ref: string | null }[]> = {};
  for (const t of (txRows || []) as any[]) {
    (purchasesByBrand[t.brand_id] ||= []).push({ id: t.id, amount: Number(t.amount) || 0, credits: t.credits || 0, status: t.status, at: t.created_at, method: t.payment_method || "", ref: t.payment_ref || null });
  }

  // Businesses that already hold a creator account on the same phone (the admin opened it, they registered it)
  const { data: creatorRows } = await supabase.from("creator_profiles").select("user_id");
  const creatorUsers = new Set(((creatorRows || []) as { user_id: string }[]).map((c) => c.user_id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brands = (data || []).map((u: any) => {
    const profile = Array.isArray(u.brand_profiles) ? u.brand_profiles[0] : u.brand_profiles;
    const hearts = profile?.id ? heartsByBrand[profile.id] || [] : [];
    const purchases = profile?.id ? (purchasesByBrand[profile.id] || []).slice(0, 20) : [];
    return {
      hearts_sent: hearts.length,
      hearts_to: hearts,
      purchases,
      purchases_paid: purchases.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0),
      // The admin opened the creator side for this business (022); has_creator_profile = they already registered it
      dual_role_allowed: u.dual_role_allowed === true,
      has_creator_profile: creatorUsers.has(u.id),
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      is_active: u.is_active,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      // Completed sign-ins (027): the latest and the one before it; last_seen_at stays the activity stamp
      last_seen_at: u.last_seen_at || null,
      last_login_at: u.last_login_at || null,
      previous_login_at: u.previous_login_at || null,
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
  const dualRole: boolean | undefined = typeof body.dual_role_allowed === "boolean" ? body.dual_role_allowed : undefined;

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

  // The creator side for this business (owner, 2026-11-16): the profile then offers "הוספת חשבון יוצר/ת"
  if (dualRole !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ dual_role_allowed: dualRole, dual_role_allowed_at: dualRole ? new Date().toISOString() : null } as any)
      .eq("id", userId);
    if (error) {
      console.error("[admin/brands] dual role update error:", error);
      return NextResponse.json({ error: /dual_role_allowed/.test(error.message) ? "המיגרציה 022 עדיין לא הופעלה" : "שגיאה בעדכון" }, { status: 500 });
    }
    if (dualRole) {
      await createNotification({
        userId,
        type: "dual_role_allowed",
        title: "🎬 נפתחה לכם האפשרות לחשבון יוצר/ת",
        body: "בפרופיל מופיע עכשיו \"הוספת חשבון יוצר/ת\" — אותו מספר טלפון, שני ממשקים, מעבר ביניהם מהפרופיל.",
        data: { role: "brand" },
      });
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
      ...(dualRole !== undefined ? { dual_role_allowed: dualRole } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
