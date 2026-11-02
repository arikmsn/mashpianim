import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { devLoginEnabled } from "@/lib/authz";

// Test-account login for non-production environments only.
// It never touches real accounts: only synthetic accounts flagged `dev_account` are created or signed in,
// the session is established server-side, and no password or secret is ever returned.
const ROLE_CONFIG: Record<string, { email: string; phone: string; fullName: string; type: "creator" | "brand"; redirect: string }> = {
  creator: { email: "creator@mashpian.online", phone: "+972500000001", fullName: "יוצר תוכן (בדיקה)", type: "creator", redirect: "/feed" },
  brand: { email: "brand@mashpian.online", phone: "+972500000002", fullName: "מפרסם (בדיקה)", type: "brand", redirect: "/brand" },
};

export async function POST(request: NextRequest) {
  if (!devLoginEnabled(process.env)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminPhone = process.env.ADMIN_LOGIN_PHONE;
  const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
  if (!adminPhone || !adminPassword) {
    return NextResponse.json({ error: "כניסת בדיקה לא מוגדרת" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SEC_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  try {
    const { phone, password, role } = await request.json();
    const normalizedPhone = String(phone || "").replace(/[-\s]/g, "").replace(/^0/, "+972");

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

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    let authUser = existingUsers?.users?.find((u) => u.email === config.email);

    if (authUser && authUser.user_metadata?.dev_account !== true) {
      // Never take over an account that was not created by this endpoint
      return NextResponse.json({ error: "חשבון הבדיקה אינו זמין" }, { status: 409 });
    }

    // One-time password used only for the server-side sign-in below; never returned
    const oneTimePassword = crypto.randomUUID();

    if (authUser) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: oneTimePassword });
      if (error) {
        return NextResponse.json({ error: "שגיאה בהכנת חשבון הבדיקה" }, { status: 500 });
      }
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: config.email,
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: { role, dev_account: true },
      });
      if (createError || !newUser.user) {
        return NextResponse.json({ error: "שגיאה ביצירת חשבון הבדיקה" }, { status: 500 });
      }
      authUser = newUser.user;
    }

    // Ensure the app user row and role profile exist for the test account
    const { data: existingDbUser } = await supabaseAdmin
      .from("users")
      .select("id, type")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    let dbUserId: string;
    if (existingDbUser) {
      dbUserId = (existingDbUser as any).id;
      if ((existingDbUser as any).type !== config.type) {
        await (supabaseAdmin.from("users") as any)
          .update({ type: config.type, full_name: config.fullName, is_active: true })
          .eq("id", dbUserId);
      }
    } else {
      const { data: newDbUser, error: insertError } = await (supabaseAdmin.from("users") as any)
        .insert({
          auth_user_id: authUser.id,
          phone: config.phone,
          email: config.email,
          full_name: config.fullName,
          type: config.type,
          is_active: true,
          onboarding_completed: true,
        })
        .select("id")
        .single();
      if (insertError) {
        console.error("[dev-login] insert user error:", insertError);
        return NextResponse.json({ error: "שגיאה ביצירת פרופיל הבדיקה" }, { status: 500 });
      }
      dbUserId = newDbUser.id;
    }

    if (role === "creator") {
      const { data: existing } = await supabaseAdmin.from("creator_profiles").select("id").eq("user_id", dbUserId).maybeSingle();
      if (!existing) {
        await (supabaseAdmin.from("creator_profiles") as any).insert({
          user_id: dbUserId,
          bio: "חשבון בדיקה ליוצר תוכן",
          categories: ["אופנה", "לייפסטייל"],
          level: "creator",
        });
      }
    } else if (role === "brand") {
      const { data: existing } = await supabaseAdmin.from("brand_profiles").select("id").eq("user_id", dbUserId).maybeSingle();
      if (!existing) {
        await (supabaseAdmin.from("brand_profiles") as any).insert({
          user_id: dbUserId,
          shop_name: "מותג בדיקה",
          category: "טכנולוגיה",
          categories: ["טכנולוגיה"],
          website_url: "https://example.com",
          description: "חשבון בדיקה למפרסם",
          total_credits: 10,
          used_credits: 0,
        });
      }
    }

    // Establish the session on the server so the secret never leaves it
    const userClient = await createServerClient();
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: config.email,
      password: oneTimePassword,
    });
    if (signInError) {
      console.error("[dev-login] sign-in error:", signInError.message);
      return NextResponse.json({ error: "שגיאה בכניסה לחשבון הבדיקה" }, { status: 500 });
    }

    return NextResponse.json({ success: true, role, redirect: config.redirect });
  } catch (err) {
    console.error("[dev-login] error:", err);
    return NextResponse.json({ error: "שגיאה בכניסת בדיקה" }, { status: 500 });
  }
}
