import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";
import { getSection, mergeSiteContent, sanitizeSectionInput, sectionViewHref, SITE_CONTENT_DEFAULTS, validateFieldValue } from "@/lib/site-content";
import { loadSiteContentRows } from "@/lib/site-content-server";

// The content registry's API (design package v3, "ניהול תוכן מהאדמין"). The schema in lib/site-content.ts is the
// single source of truth: GET answers with the defaults merged with the stored overrides (public: the pages and
// the in-app walkthrough read it), PUT stores one section after sanitising it against the schema.

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ content: SITE_CONTENT_DEFAULTS, stored: {}, meta: {} });
  }
  const { rows, meta } = await loadSiteContentRows();
  const content = mergeSiteContent(rows);
  // The stored rows, limited to the keys the schema knows (what "restore default" compares against)
  const stored: Record<string, unknown> = {};
  for (const [id, data] of Object.entries(rows)) {
    const section = getSection(id);
    if (section) stored[id] = sanitizeSectionInput(section, data);
  }
  return NextResponse.json({ content, stored, meta }, { headers: { "Cache-Control": "no-store" } });
}

const today = () => new Date().toISOString().slice(0, 10);

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { section?: string; data?: unknown; materialChange?: boolean } | null;
  const sectionId = body?.section;
  const section = sectionId ? getSection(sectionId) : undefined;
  if (!section || !body?.data) {
    return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
  }

  const data = sanitizeSectionInput(section, body.data);

  // The terms: a material change bumps the version (every user re-accepts); a wording change keeps it
  if (section.id === "legal_terms") {
    const { data: existing } = await supabase.from("site_content").select("data").eq("id", section.id).maybeSingle();
    const prev = (existing as { data?: { version?: unknown } } | null)?.data?.version;
    const prevVersion = typeof prev === "string" ? prev : null;
    if (body.materialChange === true) data.version = today();
    else if (prevVersion) data.version = prevVersion;
  }

  const warnings = section.fields.flatMap((f) => (f.key in data ? validateFieldValue(f, data[f.key]) : []));

  const { error } = await supabase
    .from("site_content")
    .upsert({ id: section.id, data, updated_at: new Date().toISOString(), updated_by: adminId } as any, { onConflict: "id" });

  if (error) {
    console.error("[admin/content] upsert error:", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_content",
    entityType: "site_content",
    entityId: section.id,
    details: { section: section.id, keys: Object.keys(data), materialChange: body.materialChange === true },
  });

  // The public pages are static (ISR): refresh the one this section lives on, right now
  const href = sectionViewHref(section);
  const path = href.split("#")[0] || "/";
  try {
    revalidatePath(path === "" ? "/" : path);
    if (section.page === "home" || section.page === "quiz" || section.id === "seo") revalidatePath("/");
    if (section.id === "errors") revalidatePath("/", "layout");
  } catch (err) {
    console.error("[admin/content] revalidate:", err);
  }

  return NextResponse.json({ success: true, data, warnings, version: section.id === "legal_terms" ? data.version : undefined });
}
