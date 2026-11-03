import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";

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

  // The role this session is signed in as
  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer) {
    return NextResponse.json({ count: 0 });
  }

  const userId = viewer.userId;
  const readColumn = viewer.role === "brand" ? "brand_read_at" : "creator_read_at";
  const profileId = viewer.role === "brand" ? viewer.brandProfileId : viewer.creatorProfileId;

  if (!profileId) {
    return NextResponse.json({ count: 0 });
  }

  const activeStatuses = ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"];
  const idColumn = viewer.role === "brand" ? "brand_id" : "creator_id";

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
