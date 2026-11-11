import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isClientOnboardingHow, isOnboardingStep, markSeen, normalizeOnboarding } from "@/lib/onboarding";

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST { step, how } — the signed-in account saw one of the first-time walkthrough moments (lib/onboarding.ts).
// Writes users.onboarding (migration 018) through the service role; idempotent: the first ending of a step wins.
export async function POST(request: NextRequest) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const step = (body as { step?: unknown }).step;
  const how = (body as { how?: unknown }).how;
  if (!isOnboardingStep(step) || !isClientOnboardingHow(how)) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: row, error: readError } = await (admin.from("users") as any)
    .select("id, onboarding")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (readError) {
    console.error("[onboarding/seen] read error:", readError.message);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const current = normalizeOnboarding((row as { onboarding?: unknown }).onboarding);
  const next = markSeen(current, step, how);
  if (next !== current) {
    const { error } = await (admin.from("users") as any).update({ onboarding: next }).eq("id", (row as { id: string }).id);
    if (error) {
      console.error("[onboarding/seen] update error:", error.message);
      return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, onboarding: next });
}
