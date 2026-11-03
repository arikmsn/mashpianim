import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/notifications";

const defaultContent: Record<string, Record<string, string>> = {
  hero: {
    badge: "הפלטפורמה ליוצרי תוכן ומותגים בישראל",
    title_line1: "יוצרים תוכן.",
    title_line2: "מחברים מותגים.",
    subtitle: "קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן. עסקים — קבלו תוכן UGC איכותי במחיר שפוי.",
    cta_creator: "אני יוצר/ת תוכן",
    cta_brand: "אני בעל/ת עסק",
  },
  how_it_works: {
    section_title: "שלושה צעדים פשוטים",
    step1_title: "בחרו מוצר",
    step1_desc: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור",
    step2_title: "צלמו סרטון",
    step2_desc: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים",
    step3_title: "צמחו",
    step3_desc: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים",
  },
  stats: {
    stat1_value: "100%",
    stat1_label: "חינם ליוצרים",
    stat2_value: "10",
    stat2_label: "ימים ליצירת סרטון",
    stat3_value: "3",
    stat3_label: "צעדים פשוטים",
  },
  creators: {
    title_line1: "הפכו את",
    title_line2: "התשוקה למקצוע",
    benefit1: "קבלו מוצרים חינם מהמותגים המובילים",
    benefit2: "צלמו תוכן בסגנון שלכם, בקצב שלכם",
    benefit3: "צמחו עם מערכת דירוגים ייחודית",
    benefit4: "בנו פורטפוליו מקצועי מרשים",
    cta: "הצטרפו כיוצרי תוכן",
  },
  brands: {
    title_line1: "תוכן שעובד",
    title_line2: "בלי הפקות יקרות",
    benefit1: "תוכן UGC אותנטי שמביא תוצאות",
    benefit2: "מחירים שפויים — פנייה אחת = סרטון אחד",
    benefit3: "יוצרים מאומתים ומדורגים",
    benefit4: "ניהול קל דרך לוח בקרה חכם",
    cta: "הצטרפו כמפרסמים",
  },
  cta_final: {
    title_line1: "מוכנים",
    title_line2: "להתחיל?",
    subtitle: "הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן.",
    cta_primary: "הרשמה חינם",
    cta_secondary: "אני מפרסם",
  },
  footer: {
    tagline: "הפלטפורמה ליוצרי תוכן ומותגים",
    copyright: "Mashpian. כל הזכויות שמורות.",
  },
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ content: defaultContent });
  }

  // Content reading is public (landing page needs it)
  try {
    const supabase = await (await import("@/lib/supabase/server")).createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("id, data");

    if (error) {
      return NextResponse.json({ content: defaultContent });
    }

    const content = { ...defaultContent };
    for (const row of (data || []) as any[]) {
      content[row.id] = row.data as Record<string, string>;
    }

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: defaultContent });
  }
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { section, data } = body as { section: string; data: Record<string, string> };

  if (!section || !data) {
    return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
  }

  const { error } = await supabase
    .from("site_content")
    .upsert(
      { id: section, data, updated_at: new Date().toISOString(), updated_by: adminId } as any,
      { onConflict: "id" }
    );

  if (error) {
    console.error("[admin/content] upsert error:", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_content",
    entityType: "site_content",
    details: { section, keys: Object.keys(data) },
  });

  return NextResponse.json({ success: true });
}
