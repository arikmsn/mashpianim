import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "missing userId" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("type, onboarding_completed")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (dbUser?.onboarding_completed && dbUser?.type) {
    return NextResponse.json({ userType: dbUser.type });
  }

  return NextResponse.json({ userType: null });
}
