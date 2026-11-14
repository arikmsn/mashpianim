import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeSumitTransaction } from "@/lib/payments-server";
import { returnParams } from "@/lib/payments";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mashpian.online";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function land(outcome: string, credits?: number): NextResponse {
  const url = new URL("/brand", APP_URL);
  url.searchParams.set("purchase", outcome);
  if (credits) url.searchParams.set("credits", String(credits));
  return NextResponse.redirect(url, { status: 303 });
}

// SUMIT sends the buyer here after a successful payment with OG-PaymentID / OG-CustomerID / OG-ExternalIdentifier.
// Public by nature (the browser arrives from SUMIT, no session is assumed) and harmless to replay: nothing is
// credited unless SUMIT itself confirms the payment for this order, and only once.
export async function GET(request: NextRequest) {
  const { paymentId, transactionId } = returnParams(request.nextUrl.searchParams);
  if (!paymentId || !transactionId) return land("failed");
  const admin = getAdminClient();
  if (!admin) return land("failed");

  const result = await completeSumitTransaction(admin, transactionId, paymentId, "return");
  switch (result.status) {
    case "completed":
    case "already":
      return land("success", result.credits);
    case "error":
      // SUMIT could not be asked right now; the cron verifies the order within 15 minutes
      return land("pending");
    default:
      return land("failed");
  }
}
