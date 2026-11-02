import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";

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
      brand_profiles(shop_name, category, website_url, total_credits, used_credits, description, logo_url)
    `)
    .eq("type", "brand")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/brands] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מותגים" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brands = (data || []).map((u: any) => {
    const profile = Array.isArray(u.brand_profiles) ? u.brand_profiles[0] : u.brand_profiles;
    return {
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      is_active: u.is_active,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      shop_name: profile?.shop_name || "",
      category: profile?.category || "",
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

  const { isAdmin, supabase } = await verifyAdmin();
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

  return NextResponse.json({ success: true });
}
