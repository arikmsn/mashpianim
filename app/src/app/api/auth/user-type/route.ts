import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Returns the onboarding status of the signed-in user only.
export async function GET(request: NextRequest) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const requested = request.nextUrl.searchParams.get("userId");
  if (requested && requested !== user.id) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("type, onboarding_completed")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dbUser?.onboarding_completed && dbUser?.type) {
    return NextResponse.json({ userType: dbUser.type });
  }

  return NextResponse.json({ userType: null });
}
