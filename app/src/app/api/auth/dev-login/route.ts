import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_PHONE = "+972502463555";
const ADMIN_PASSWORD = "612861";
const SHARED_AUTH_PASSWORD = "Mashpianim!Admin612861";

const ROLE_CONFIG: Record<string, { email: string; phone: string; fullName: string }> = {
  admin: { email: "admin@mashpianim.co.il", phone: "+972502463555", fullName: "מנהל מערכת" },
  creator: { email: "creator@mashpianim.co.il", phone: "+972500000001", fullName: "יוצר תוכן (בדיקה)" },
  brand: { email: "brand@mashpianim.co.il", phone: "+972500000002", fullName: "מפרסם (בדיקה)" },
};

export async function POST(request: NextRequest) {
  try {
    const { phone, password, role } = await request.json();

    const normalizedPhone = phone?.replace(/[-\s]/g, "").replace(/^0/, "+972");

    if (normalizedPhone !== ADMIN_PHONE || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "מספר טלפון או סיסמה שגויים" }, { status: 401 });
    }

    if (!role) {
      return NextResponse.json({ success: true, step: "choose_role" });
    }

    const config = ROLE_CONFIG[role];
    if (!config) {
      return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find((u) => u.email === config.email);

    if (user) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
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
      user = newUser.user;

      await supabaseAdmin.from("users").upsert({
        id: user.id,
        phone: config.phone,
        email: config.email,
        full_name: config.fullName,
        role,
        status: "active",
      });

      if (role === "creator") {
        await supabaseAdmin.from("creator_profiles").upsert({
          user_id: user.id,
          display_name: config.fullName,
          bio: "חשבון בדיקה ליוצר תוכן",
          categories: ["אופנה", "לייף סטייל"],
          level: "starter",
          instagram_url: "https://instagram.com/test_creator",
          tiktok_url: "https://tiktok.com/@test_creator",
        });
      } else if (role === "brand") {
        await supabaseAdmin.from("brand_profiles").upsert({
          user_id: user.id,
          business_name: "מותג בדיקה בע\"מ",
          business_type: "e-commerce",
          website_url: "https://example.com",
          description: "חשבון בדיקה למפרסם",
          credits_balance: 10,
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
