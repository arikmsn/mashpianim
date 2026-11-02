import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

// Resolves the signed-in app user; all table access goes through the service-role client
// (client roles no longer have write access to any table).
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data: dbUser } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return (dbUser as { id?: string } | null)?.id || null;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ notifications: [] });
  }

  const userId = await currentUserId();
  const admin = getSupabaseAdmin();
  if (!userId || !admin) {
    return NextResponse.json({ notifications: [] });
  }

  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notifications] list error:", error);
    return NextResponse.json({ notifications: [] });
  }

  return NextResponse.json({ notifications: data || [] });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const userId = await currentUserId();
  const admin = getSupabaseAdmin();
  if (!userId || !admin) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = await request.json();
  const { id, read } = body;

  if (!id) {
    return NextResponse.json({ error: "מזהה התראה חסר" }, { status: 400 });
  }

  // Scoped to the caller's own notifications
  const { error } = await admin
    .from("notifications")
    .update({ read: read ?? true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[notifications] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
