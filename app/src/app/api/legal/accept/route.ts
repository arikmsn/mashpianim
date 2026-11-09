import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/notifications";
import { TERMS_VERSION } from "@/lib/legal";

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST — the signed-in account accepted the current terms (the gate in the app). Stamps users.terms_accepted_at /
// terms_version (migration 017); a later TERMS_VERSION makes the gate ask again.
export async function POST() {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const now = new Date().toISOString();
  const { data, error } = await (admin.from("users") as any)
    .update({ terms_accepted_at: now, terms_version: TERMS_VERSION })
    .eq("auth_user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[legal/accept] update error:", error.message);
    return NextResponse.json({ error: "שגיאה בשמירת האישור" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const userId = (data as { id: string }).id;
  after(async () => {
    try {
      await logActivity({ actorId: userId, action: "terms_accepted", entityType: "user", entityId: userId, details: { version: TERMS_VERSION } });
    } catch (err) {
      console.error("[legal/accept] activity log failed:", err);
    }
  });

  return NextResponse.json({ success: true, terms_accepted_at: now, terms_version: TERMS_VERSION });
}
