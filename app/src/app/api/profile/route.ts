import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { pickAllowedFields, USER_EDITABLE_FIELDS, CREATOR_EDITABLE_FIELDS, BRAND_EDITABLE_FIELDS } from "@/lib/authz";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_SUPABASE_URL &&
    process.env.NEXT_SUPABASE_ANON_KEY
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { data: rawUser } = await admin
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();
  const userData = rawUser as any;

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // `role` = the role this session is signed in as; `roles` = every role the account holds (for switching)
  const viewer = await resolveViewer(admin, authUser.id, await readActiveRole());
  const role = viewer?.role || "creator";
  const roles = viewer?.roles || [role];

  if (role === "creator") {
    let { data: rawProfile } = await admin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userData.id)
      .maybeSingle();

    if (!rawProfile && userData.type === "admin") {
      const { data: newProfile } = await (admin.from("creator_profiles") as any)
        .insert({ user_id: userData.id, categories: ["אופנה"], level: "creator" })
        .select("*")
        .single();
      rawProfile = newProfile;
    }

    const { count: portfolioCount } = await admin
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userData.id)
      .is("connection_id", null);

    return NextResponse.json({
      user: userData,
      role,
      roles,
      profile: { ...((rawProfile as any) || {}), portfolio_count: portfolioCount || 0 },
    });
  }

  if (role === "brand") {
    const { data: rawProfile } = await admin
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userData.id)
      .maybeSingle();

    return NextResponse.json({
      user: userData,
      role,
      roles,
      profile: rawProfile || {},
    });
  }

  return NextResponse.json({ user: userData, role, roles, profile: {} });
}

export async function PUT(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const body = await req.json();
  const { userFields, profileFields } = body;

  const { data: rawUser } = await admin
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();
  const userData = rawUser as any;

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // Only explicitly editable fields are applied; role, activation, phone, credits, level, etc. are ignored
  const safeUserFields = pickAllowedFields(userFields, USER_EDITABLE_FIELDS);
  if (Object.keys(safeUserFields).length > 0) {
    const { error } = await admin
      .from("users")
      .update(safeUserFields)
      .eq("id", userData.id);

    if (error) {
      console.error("[profile] update user error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון פרטים" }, { status: 500 });
    }
  }

  if (profileFields && typeof profileFields === "object") {
    // The profile being edited is the one of the role this session is signed in as
    const sessionRole = (await resolveViewer(admin, authUser.id, await readActiveRole()))?.role;
    if (sessionRole === "creator") {
      const safeProfile = pickAllowedFields(profileFields, CREATOR_EDITABLE_FIELDS);
      const { error } = Object.keys(safeProfile).length > 0
        ? await admin.from("creator_profiles").update(safeProfile).eq("user_id", userData.id)
        : { error: null };

      if (error) {
        console.error("[profile] update creator error:", error);
        return NextResponse.json({ error: "שגיאה בעדכון פרופיל" }, { status: 500 });
      }
    } else if (userData.type === "brand") {
      const safeProfile = pickAllowedFields(profileFields, BRAND_EDITABLE_FIELDS);
      const { error } = Object.keys(safeProfile).length > 0
        ? await admin.from("brand_profiles").update(safeProfile).eq("user_id", userData.id)
        : { error: null };

      if (error) {
        console.error("[profile] update brand error:", error);
        return NextResponse.json({ error: "שגיאה בעדכון פרופיל" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
