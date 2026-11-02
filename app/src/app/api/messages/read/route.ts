import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { participantRole } from "@/lib/authz";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const { connection_id } = await request.json();
  if (!connection_id) {
    return NextResponse.json({ error: "חסר מזהה חיבור" }, { status: 400 });
  }

  const { data: conn } = await admin
    .from("connections")
    .select(`
      id,
      creator_profiles!connections_creator_id_fkey(user_id),
      brand_profiles!connections_brand_id_fkey(user_id)
    `)
    .eq("id", connection_id)
    .single();

  if (!conn) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  // Only a party to the connection can mark it read, and only on their own side
  const role = participantRole(
    {
      creatorUserId: (conn as any).creator_profiles?.user_id,
      brandUserId: (conn as any).brand_profiles?.user_id,
    },
    (dbUser as any).id
  );
  if (!role) {
    return NextResponse.json({ error: "אין הרשאה לחיבור זה" }, { status: 403 });
  }

  const readColumn = role === "brand" ? "brand_read_at" : "creator_read_at";

  await admin
    .from("connections")
    .update({ [readColumn]: new Date().toISOString() } as any)
    .eq("id", connection_id);

  return NextResponse.json({ success: true });
}
