import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: rawUser } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();
  const userData = rawUser as any;

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  if (userData.type === "creator") {
    const { data: rawProfile } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userData.id)
      .single();

    return NextResponse.json({
      user: userData,
      profile: rawProfile || {},
    });
  } else if (userData.type === "brand") {
    const { data: rawProfile } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userData.id)
      .single();

    return NextResponse.json({
      user: userData,
      profile: rawProfile || {},
    });
  }

  return NextResponse.json({ user: userData, profile: {} });
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

  const body = await req.json();
  const { userFields, profileFields } = body;

  const { data: rawUser } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();
  const userData = rawUser as any;

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  if (userFields && Object.keys(userFields).length > 0) {
    const { error } = await (supabase
      .from("users") as any)
      .update(userFields)
      .eq("id", userData.id);

    if (error) {
      console.error("[profile] update user error:", error);
      return NextResponse.json({ error: "שגיאה בעדכון פרטים" }, { status: 500 });
    }
  }

  if (profileFields && Object.keys(profileFields).length > 0) {
    if (userData.type === "creator") {
      const { error } = await (supabase
        .from("creator_profiles") as any)
        .update(profileFields)
        .eq("user_id", userData.id);

      if (error) {
        console.error("[profile] update creator error:", error);
        return NextResponse.json({ error: "שגיאה בעדכון פרופיל" }, { status: 500 });
      }
    } else if (userData.type === "brand") {
      const { error } = await (supabase
        .from("brand_profiles") as any)
        .update(profileFields)
        .eq("user_id", userData.id);

      if (error) {
        console.error("[profile] update brand error:", error);
        return NextResponse.json({ error: "שגיאה בעדכון פרופיל" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
