import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { clearActiveRoleCookie, homeForRole, isActiveRole, readActiveRole, setActiveRoleCookie } from "@/lib/active-role";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// The signed-in user's onboarding status, the role this session acts as and every role the account holds.
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

  if (!dbUser?.onboarding_completed || !dbUser?.type) {
    return NextResponse.json({ userType: null, role: null, roles: [] });
  }

  const viewer = await resolveViewer(supabase, user.id, await readActiveRole());
  return NextResponse.json({ userType: dbUser.type, role: viewer?.role || null, roles: viewer?.roles || [] });
}

// Chooses the role for this session (after the OTP, or when switching from the profile). Only roles the
// account actually holds are accepted.
export async function POST(request: NextRequest) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  const role = body?.role;
  if (!isActiveRole(role)) {
    return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
  }

  const viewer = await resolveViewer(supabase, user.id);
  if (!viewer || !viewer.roles.includes(role)) {
    return NextResponse.json({ error: "החשבון הזה לא רשום בתפקיד הזה" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, role, redirect: homeForRole(role) });
  setActiveRoleCookie(response, role);
  return response;
}

// Logout clears the chosen role (the auth session itself is closed by the client)
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearActiveRoleCookie(response);
  return response;
}
