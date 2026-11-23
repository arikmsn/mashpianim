import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { sumitDocumentPdf } from "@/lib/adapters/sumit";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Ctx = { params: Promise<{ id: string }> };

// GET /api/payments/invoice/[id] — the invoice-receipt PDF SUMIT issued for one of this business's completed
// orders (owner, 2026-11-23: let businesses download their invoices and see their payments themselves).
// The document id was stored on the transaction when the payment was verified; SUMIT serves the PDF (an
// original on the first visit, a certified copy afterwards). Admins may fetch any order's invoice.
export async function GET(_request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data } = await admin.from("transactions").select("id, brand_id, status, document_id").eq("id", id).maybeSingle();
  const tx = data as { id: string; brand_id: string; status: string; document_id: string | null } | null;
  if (!tx) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  if (!viewer.isAdmin && tx.brand_id !== viewer.brandProfileId) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  if (tx.status !== "completed" || !tx.document_id || !/^\d+$/.test(tx.document_id)) {
    return NextResponse.json({ error: "להזמנה הזאת אין עדיין חשבונית" }, { status: 404 });
  }

  const pdf = await sumitDocumentPdf(Number(tx.document_id));
  if (!pdf.ok) {
    return NextResponse.json({ error: "לא הצלחנו להביא את החשבונית מסאמיט. נסו שוב בעוד רגע." }, { status: 502 });
  }
  return new NextResponse(Buffer.from(pdf.data), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="mashpian-invoice-${tx.document_id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
