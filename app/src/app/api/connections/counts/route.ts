import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { brandBucket } from "@/lib/connection-flow";

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Hearts waiting on the viewer — the badge on the "חיבורים" nav item and the brand's list tabs.
// Brand: chose_you (creators who hearted, no answer yet) + match (mutual, awaiting the paid confirmation).
// Creator: brand hearts not answered yet.
export async function GET() {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ actionable: 0 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ actionable: 0 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer) return NextResponse.json({ actionable: 0 });

  if (viewer.role === "brand" && viewer.brandProfileId) {
    const { data } = await admin
      .from("connections")
      .select("status, initiated_by, mutual_at")
      .eq("brand_id", viewer.brandProfileId)
      .eq("status", "pending");
    let choseYou = 0;
    let match = 0;
    for (const c of (data || []) as { status: string; initiated_by: string | null; mutual_at: string | null }[]) {
      const bucket = brandBucket(c);
      if (bucket === "chose_you") choseYou++;
      else if (bucket === "match") match++;
    }
    return NextResponse.json({ chose_you: choseYou, match, actionable: choseYou + match });
  }

  if (viewer.role === "creator" && viewer.creatorProfileId) {
    const { count } = await admin
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", viewer.creatorProfileId)
      .eq("status", "pending")
      .eq("initiated_by", "brand")
      .is("mutual_at", null);
    return NextResponse.json({ actionable: count || 0 });
  }

  return NextResponse.json({ actionable: 0 });
}
