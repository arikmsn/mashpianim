import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SHARED_AUTH_PASSWORD = process.env.ADMIN_AUTH_SECRET || "change-me-in-env";

const ROLE_CONFIG: Record<string, { email: string; phone: string; fullName: string; type: string }> = {
  admin: { email: "admin@mashpianim.co.il", phone: "+972502463555", fullName: "מנהל מערכת", type: "admin" },
  creator: { email: "creator@mashpianim.co.il", phone: "+972500000001", fullName: "יוצר תוכן (בדיקה)", type: "creator" },
  brand: { email: "brand@mashpianim.co.il", phone: "+972500000002", fullName: "מפרסם (בדיקה)", type: "brand" },
};

export async function POST(request: NextRequest) {
  const adminPhone = process.env.ADMIN_LOGIN_PHONE;
  const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;

  if (!adminPhone || !adminPassword) {
    return NextResponse.json(
      { error: "כניסת מנהל לא מוגדרת" },
      { status: 403 }
    );
  }

  const supabaseUrl = process.env.NEXT_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SEC_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "המערכת לא מוגדרת" },
      { status: 503 }
    );
  }

  try {
    const { phone, password, role } = await request.json();

    const normalizedPhone = phone?.replace(/[-\s]/g, "").replace(/^0/, "+972");

    if (normalizedPhone !== adminPhone || password !== adminPassword) {
      return NextResponse.json({ error: "מספר טלפון או סיסמה שגויים" }, { status: 401 });
    }

    if (!role) {
      return NextResponse.json({ success: true, step: "choose_role" });
    }

    const config = ROLE_CONFIG[role];
    if (!config) {
      return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = existingUsers?.users?.find((u) => u.email === config.email);

    if (authUser) {
      await (supabaseAdmin.auth.admin as any).updateUserById(authUser.id, {
        password: SHARED_AUTH_PASSWORD,
      });
    } else {
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: config.email,
          password: SHARED_AUTH_PASSWORD,
          phone: config.phone,
          phone_confirm: true,
          email_confirm: true,
          user_metadata: { role, dev_account: true },
        });
      if (createError) {
        return NextResponse.json(
          { error: `שגיאה ביצירת משתמש: ${createError.message}` },
          { status: 500 }
        );
      }
      authUser = newUser.user;
    }

    // Always ensure user row exists in users table with correct type
    const { data: existingDbUser } = await supabaseAdmin
      .from("users")
      .select("id, type")
      .eq("auth_user_id", authUser!.id)
      .single();

    let dbUserId: string;

    if (existingDbUser) {
      dbUserId = (existingDbUser as any).id;
      if ((existingDbUser as any).type !== config.type) {
        await (supabaseAdmin.from("users") as any)
          .update({ type: config.type, full_name: config.fullName, is_active: true })
          .eq("id", dbUserId);
      }
    } else {
      const { data: newDbUser, error: insertError } = await (supabaseAdmin
        .from("users") as any)
        .insert({
          auth_user_id: authUser!.id,
          phone: config.phone,
          email: config.email,
          full_name: config.fullName,
          type: config.type,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[dev-login] insert user error:", insertError);
        return NextResponse.json(
          { error: `שגיאה ביצירת פרופיל: ${insertError.message}` },
          { status: 500 }
        );
      }
      dbUserId = newDbUser.id;
    }

    // Create role-specific profile if needed
    if (role === "creator") {
      const { data: existing } = await supabaseAdmin
        .from("creator_profiles")
        .select("id")
        .eq("user_id", dbUserId)
        .single();

      if (!existing) {
        await (supabaseAdmin.from("creator_profiles") as any).insert({
          user_id: dbUserId,
          bio: "חשבון בדיקה ליוצר תוכן",
          categories: ["אופנה", "לייפסטייל"],
          level: "creator",
        });
      }
    } else if (role === "brand") {
      const { data: existing } = await supabaseAdmin
        .from("brand_profiles")
        .select("id")
        .eq("user_id", dbUserId)
        .single();

      if (!existing) {
        await (supabaseAdmin.from("brand_profiles") as any).insert({
          user_id: dbUserId,
          shop_name: "מותג בדיקה",
          category: "טכנולוגיה",
          website_url: "https://example.com",
          description: "חשבון בדיקה למפרסם",
          total_credits: 10,
          used_credits: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      email: config.email,
      authPassword: SHARED_AUTH_PASSWORD,
      role,
      redirect: role === "admin" ? "/admin" : "/feed",
    });
  } catch (err) {
    console.error("[dev-login] error:", err);
    return NextResponse.json({ error: "שגיאה בכניסה" }, { status: 500 });
  }
}
