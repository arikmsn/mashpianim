import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";

const mockCreators = [
  { id: "1", full_name: "נועה כהן", phone: "050-1234567", is_active: true, level: "creator_plus", categories: ["ביוטי", "אופנה"], hearts: 42, completed_connections: 15, tiktok_handle: "@noa_cohen", instagram_handle: "@noa.cohen", city: "תל אביב", created_at: "2026-01-15" },
  { id: "2", full_name: "דנה לוי", phone: "050-2345678", is_active: true, level: "creator", categories: ["טכנולוגיה"], hearts: 18, completed_connections: 7, tiktok_handle: "@dana_levi", instagram_handle: null, city: "חיפה", created_at: "2026-03-10" },
  { id: "3", full_name: "שרה אברהם", phone: "050-3456789", is_active: true, level: "on_the_radar", categories: ["ספורט", "לייפסטייל"], hearts: 85, completed_connections: 28, tiktok_handle: "@sara_a", instagram_handle: "@sara.avraham", city: "ירושלים", created_at: "2025-12-01" },
  { id: "4", full_name: "מיכל דוד", phone: "050-4567890", is_active: false, level: "creator", categories: ["אוכל"], hearts: 5, completed_connections: 3, tiktok_handle: null, instagram_handle: "@michal.d", city: "באר שבע", created_at: "2026-06-20" },
  { id: "5", full_name: "תמר רוזן", phone: "050-5678901", is_active: true, level: "creator_plus", categories: ["ביוטי", "בית וגינה"], hearts: 35, completed_connections: 12, tiktok_handle: "@tamar_r", instagram_handle: "@tamar.rozen", city: "רעננה", created_at: "2026-02-05" },
];

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ creators: mockCreators });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("users")
    .select(`
      id, full_name, phone, is_active, avatar_url, created_at,
      creator_profiles(level, categories, hearts, completed_connections, tiktok_handle, instagram_handle, city, bio)
    `)
    .eq("type", "creator")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/creators] list error:", error);
    return NextResponse.json({ creators: mockCreators });
  }

  const creators = (data || []).map((u: Record<string, unknown>) => {
    const profile = Array.isArray(u.creator_profiles) ? u.creator_profiles[0] : u.creator_profiles;
    return {
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      is_active: u.is_active,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      level: profile?.level || "creator",
      categories: profile?.categories || [],
      hearts: profile?.hearts || 0,
      completed_connections: profile?.completed_connections || 0,
      tiktok_handle: profile?.tiktok_handle,
      instagram_handle: profile?.instagram_handle,
      city: profile?.city,
      bio: profile?.bio,
    };
  });

  return NextResponse.json({ creators });
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
  const { userId, is_active, level } = body;

  if (!userId) {
    return NextResponse.json({ error: "מזהה משתמש חסר" }, { status: 400 });
  }

  if (is_active !== undefined) {
    const { error } = await supabase
      .from("users")
      .update({ is_active })
      .eq("id", userId);

    if (error) {
      console.error("[admin/creators] update user error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
    }
  }

  if (level) {
    const { error } = await supabase
      .from("creator_profiles")
      .update({ level })
      .eq("user_id", userId);

    if (error) {
      console.error("[admin/creators] update level error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון רמה" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
