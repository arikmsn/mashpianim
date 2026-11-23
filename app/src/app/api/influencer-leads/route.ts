import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, clientIp, RATE_LIMITS, rateLimitedResponse } from "@/lib/rate-limit";
import { createNotification, logActivity } from "@/lib/notifications";
import { answersSummary, quizQuestions, validateLeadInput } from "@/lib/influencer-leads";
import { getSiteContent } from "@/lib/site-content-server";

// The influencer quiz's lead (design package v3, Phase C). Public, rate limited per IP, validated on the server
// against the quiz's option keys, written with the service role into influencer_leads (migration 026), logged,
// and every admin gets a bell notification. Answers only `{ ok: true }`: no id, no prices, no availability.

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const limit = await checkRateLimit(admin, "influencer_lead", clientIp(request.headers), RATE_LIMITS.influencerLeadIp);
  if (!limit.allowed) return rateLimitedResponse(limit);

  const body = await request.json().catch(() => null);
  const { content } = await getSiteContent();
  const questions = quizQuestions(content.quiz);
  const check = validateLeadInput(body, questions);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const lead = check.value;
  const { data: row, error } = await admin
    .from("influencer_leads")
    .insert({
      answers: lead.answers,
      full_name: lead.full_name,
      business_name: lead.business_name,
      phone: lead.phone,
      email: lead.email,
      note: lead.note,
      utm: lead.utm,
      source: "homepage_quiz",
    } as any)
    .select("id")
    .single();

  if (error || !row) {
    // 42P01 / PGRST205: the table does not exist yet (migration 026 not applied)
    const code = (error as { code?: string } | null)?.code;
    const missing = code === "42P01" || code === "PGRST205";
    console.error("[influencer-leads] insert error:", error);
    return NextResponse.json({ error: missing ? "unavailable" : "network" }, { status: missing ? 503 : 500 });
  }

  const leadId = (row as { id: string }).id;
  await logActivity({ action: "influencer_lead_created", entityType: "influencer_lead", entityId: leadId, details: { answers: lead.answers, utm: lead.utm } });

  // Every admin: a bell notification that opens /admin/leads
  const { data: admins } = await admin.from("users").select("id").or("type.eq.admin,is_admin.eq.true");
  const summary = answersSummary(lead.answers, questions);
  await Promise.all(
    ((admins || []) as { id: string }[]).map((a) =>
      createNotification({
        userId: a.id,
        type: "influencer_lead",
        title: `⭐ ליד משפיענים: ${lead.business_name || lead.full_name}`,
        body: `${lead.full_name}${summary ? ` · ${summary}` : ""}`.slice(0, 200),
        data: { leadId, role: "admin" },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
