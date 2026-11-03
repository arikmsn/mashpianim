import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";
import { DEFAULT_TIMELINES } from "@/lib/settings";

// Section ids and keys match the site_settings rows. `timelines` is read by the connection state machine
// (src/lib/settings.ts) and by match_connection() in the database; the rest is informational for now.
export const SETTINGS_SECTIONS = ["general", "credits", "moderation", "timelines"] as const;
type Section = (typeof SETTINGS_SECTIONS)[number];

const defaultSettings: Record<Section, Record<string, unknown>> = {
  general: {
    platform_name: "Mashpian",
    support_email: "support@mashpian.online",
    support_phone: "",
  },
  credits: {
    single_price: 100,
    pack_5_price: 450,
    pack_10_price: 800,
    pack_20_price: 1400,
  },
  moderation: {
    auto_ocr: true,
    chat_filter: true,
    speech_detection: true,
    nsfw_filter: true,
  },
  timelines: { ...DEFAULT_TIMELINES },
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
    .select("id, data");

  if (error) {
    return NextResponse.json({ settings: defaultSettings });
  }

  const settings: Record<string, Record<string, unknown>> = { ...defaultSettings };
  for (const row of (data || []) as any[]) {
    settings[row.id] = { ...(settings[row.id] || {}), ...(row.data as Record<string, unknown>) };
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, userId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { section, data } = (body || {}) as { section?: string; data?: Record<string, unknown> };

  if (!section || !(SETTINGS_SECTIONS as readonly string[]).includes(section) || !data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "פרטים חסרים או לא תקינים" }, { status: 400 });
  }

  // `updated_by` references auth.users, so it takes the auth id (writing the public.users id here broke
  // every save with a foreign-key error)
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { id: section, data, updated_at: new Date().toISOString(), updated_by: userId } as any,
      { onConflict: "id" }
    );

  if (error) {
    console.error("[admin/settings] upsert error:", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_settings",
    entityType: "site_settings",
    details: { section, data },
  });

  return NextResponse.json({ success: true });
}
