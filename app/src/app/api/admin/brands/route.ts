import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";

const mockBrands = [
  { id: "1", full_name: "אבי כהן", phone: "050-1111111", is_active: true, shop_name: "GlowUp Skincare", category: "ביוטי וטיפוח", website_url: "https://glowup.co.il", total_credits: 45, used_credits: 12, created_at: "2025-12-01" },
  { id: "2", full_name: "דוד לוי", phone: "050-2222222", is_active: true, shop_name: "TechFit", category: "טכנולוגיה", website_url: "https://techfit.co.il", total_credits: 22, used_credits: 9, created_at: "2026-01-15" },
  { id: "3", full_name: "רחל מזרחי", phone: "050-3333333", is_active: true, shop_name: "UrbanStyle", category: "אופנה", website_url: "https://urbanstyle.co.il", total_credits: 67, used_credits: 23, created_at: "2025-11-01" },
  { id: "4", full_name: "משה פרידמן", phone: "050-4444444", is_active: true, shop_name: "ChefHome", category: "מזון ומשקאות", website_url: null, total_credits: 10, used_credits: 2, created_at: "2026-10-01" },
  { id: "5", full_name: "יוסי חן", phone: "050-5555555", is_active: true, shop_name: "ZenLife", category: "ספורט ובריאות", website_url: "https://zenlife.co.il", total_credits: 30, used_credits: 11, created_at: "2026-03-20" },
  { id: "6", full_name: "נורית שרון", phone: "050-6666666", is_active: true, shop_name: "LightHouse", category: "ניקיון ובית", website_url: null, total_credits: 15, used_credits: 7, created_at: "2026-05-10" },
];

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ brands: mockBrands });
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
    return NextResponse.json({ brands: mockBrands });
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
    return NextResponse.json({ success: true });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, is_active } = body;

  if (!userId) {
    return NextResponse.json({ error: "מזהה משתמש חסר" }, { status: 400 });
  }

  if (is_active !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ is_active })
      .eq("id", userId);

    if (error) {
      console.error("[admin/brands] update error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
