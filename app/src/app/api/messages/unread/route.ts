import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ count: 0 });
  }

  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ count: 0 });
  }

  const userType = (dbUser as any).type;
  const userId = (dbUser as any).id;
  const readColumn = userType === "brand" ? "brand_read_at" : "creator_read_at";

  let profileId: string | null = null;
  if (userType === "creator") {
    const { data: cp } = await admin
      .from("creator_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();
    profileId = cp ? (cp as any).id : null;
  } else if (userType === "brand") {
    const { data: bp } = await admin
      .from("brand_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();
    profileId = bp ? (bp as any).id : null;
  }

  if (!profileId) {
    return NextResponse.json({ count: 0 });
  }

  const activeStatuses = ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"];
  const idColumn = userType === "brand" ? "brand_id" : "creator_id";

  const { data: connections } = await admin
    .from("connections")
    .select(`id, ${readColumn}`)
    .eq(idColumn, profileId)
    .in("status", activeStatuses);

  if (!connections || connections.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  let total = 0;
  for (const conn of connections) {
    const readAt = (conn as any)[readColumn] || "1970-01-01T00:00:00Z";
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", (conn as any).id)
      .neq("sender_id", userId)
      .gt("created_at", readAt);
    total += count || 0;
  }

  return NextResponse.json({ count: total });
}
