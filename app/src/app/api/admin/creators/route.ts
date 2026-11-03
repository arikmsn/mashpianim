import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";

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
      id, full_name, phone, is_active, avatar_url, created_at,
      creator_profiles(level, categories, hearts, completed_connections, tiktok_handle, instagram_handle, city, bio)
    `)
    .eq("type", "creator")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/creators] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת יוצרים" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creators = (data || []).map((u: any) => {
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
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, is_active, level } = body;

  if (!userId) {
    return NextResponse.json({ error: "מזהה משתמש חסר" }, { status: 400 });
  }

  if (is_active !== undefined) {
    const { error } = await (supabase
      .from("users") as any)
      .update({ is_active })
      .eq("id", userId);

    if (error) {
      console.error("[admin/creators] update user error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
    }
  }

  if (level) {
    const { error } = await (supabase
      .from("creator_profiles") as any)
      .update({ level })
      .eq("user_id", userId);

    if (error) {
      console.error("[admin/creators] update level error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון רמה" }, { status: 500 });
    }
  }

  // Admin actions are audited
  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_creator",
    entityType: "user",
    entityId: userId,
    details: {
      ...(is_active !== undefined ? { is_active } : {}),
      ...(level ? { level } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
