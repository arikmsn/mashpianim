import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { isLeadStatus } from "@/lib/influencer-leads";

// The influencer leads for /admin/leads (design package v3, Phase C): newest first, optional status filter
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("influencer_leads")
    .select("id, created_at, answers, full_name, business_name, phone, email, note, source, utm, status, admin_note, handled_by, handled_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (isLeadStatus(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    const code = (error as { code?: string }).code;
    const missing = code === "42P01" || code === "PGRST205";
    return NextResponse.json({ error: missing ? "הטבלה עדיין לא קיימת (migration 026)" : "שגיאה בטעינה", missing }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json({ leads: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
