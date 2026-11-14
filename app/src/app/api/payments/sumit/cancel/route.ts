import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { returnParams } from "@/lib/payments";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mashpian.online";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// SUMIT sends the buyer here when they leave the payment page (OG-ExternalIdentifier = our order). The order
// closes as cancelled — unless it already completed (a replayed link never undoes a paid order).
export async function GET(request: NextRequest) {
  const { transactionId } = returnParams(request.nextUrl.searchParams);
  const admin = getAdminClient();
  if (admin && transactionId) {
    await admin
      .from("transactions")
      .update({ status: "failed", failure_reason: "cancelled" } as any)
      .eq("id", transactionId)
      .eq("provider", "sumit")
      .eq("status", "pending");
  }
  const url = new URL("/brand", APP_URL);
  url.searchParams.set("purchase", "cancelled");
  return NextResponse.redirect(url, { status: 303 });
}
