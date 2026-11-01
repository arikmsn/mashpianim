import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

const defaultSettings: Record<string, Record<string, string>> = {
  general: {
    platform_name: "Mashpianim",
    support_email: "support@mashpianim.co.il",
    support_phone: "03-1234567",
  },
  credits: {
    single_price: "100",
    pack_5_price: "450",
    pack_10_price: "800",
    pack_20_price: "1400",
  },
  moderation: {
    ocr_enabled: "true",
    chat_filter_enabled: "true",
    speech_detection_enabled: "true",
    nsfw_filter_enabled: "true",
  },
  deadlines: {
    shipping_days: "7",
    filming_days: "10",
    review_days: "7",
    max_revisions: "1",
  },
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: defaultSettings });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("site_settings")
    .select("section, data");

  if (error) {
    return NextResponse.json({ settings: defaultSettings });
  }

  const settings = { ...defaultSettings };
  for (const row of data || []) {
    settings[row.section] = row.data as Record<string, string>;
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { section, data } = body;

  if (!section || !data) {
    return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
  }

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { section, data, updated_at: new Date().toISOString() },
      { onConflict: "section" }
    );

  if (error) {
    console.error("[admin/settings] upsert error:", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
