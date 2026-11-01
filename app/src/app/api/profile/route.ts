import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_SUPABASE_URL &&
    process.env.NEXT_SUPABASE_ANON_KEY
  );
}

const mockCreatorProfile = {
  user: {
    id: "mock-1",
    full_name: "נועה כהן",
    phone: "050-1234567",
    email: null,
    type: "creator",
    avatar_url: null,
  },
  profile: {
    bio: "יוצרת תוכן עם אהבה למוצרי טיפוח ואופנה. תמיד מחפשת את המוצר הבא!",
    categories: ["ביוטי", "אופנה", "לייפסטייל"],
    city: "תל אביב",
    tiktok_handle: "@noahcohen",
    instagram_handle: "@noah.cohen",
    date_of_birth: "1998-03-15",
    level: "creator_plus",
    hearts: 42,
    completed_connections: 15,
  },
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(mockCreatorProfile);
  }

  try {
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
  } catch {
    return NextResponse.json(mockCreatorProfile);
  }
}

export async function PUT(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  try {
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
      await (supabase
        .from("users") as any)
        .update(userFields)
        .eq("id", userData.id);
    }

    if (profileFields && Object.keys(profileFields).length > 0) {
      if (userData.type === "creator") {
        await (supabase
          .from("creator_profiles") as any)
          .update(profileFields)
          .eq("user_id", userData.id);
      } else if (userData.type === "brand") {
        await (supabase
          .from("brand_profiles") as any)
          .update(profileFields)
          .eq("user_id", userData.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
