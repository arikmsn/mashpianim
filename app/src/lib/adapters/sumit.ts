// SUMIT (api.sumit.co.il) — the hosted payment page and payment lookups. Server-only: the API key never
// reaches the browser. Request/response shapes follow SUMIT's OpenAPI (swagger/v1/swagger.json); every call
// is a POST with JSON and answers { Status, UserErrorMessage, TechnicalErrorDetails, Data }.
import { sumitErrorMessage, sumitOk, type SumitPayment } from "@/lib/payments";

const BASE_URL = process.env.SUMIT_API_URL || "https://api.sumit.co.il";
const TIMEOUT_MS = 20_000;

export function sumitCredentials(): { CompanyID: number; APIKey: string } | null {
  const id = (process.env.SUMIT_COMPANY_ID || "").trim();
  const key = (process.env.SUMIT_API_KEY || "").trim();
  if (!/^\d+$/.test(id) || !key) return null;
  return { CompanyID: Number(id), APIKey: key };
}

export type SumitResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sumitPost<T>(path: string, body: Record<string, unknown>): Promise<SumitResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let envelope: unknown = null;
    try {
      envelope = text ? JSON.parse(text) : null;
    } catch {
      envelope = null;
    }
    if (!res.ok) {
      const msg = envelope ? sumitErrorMessage(envelope) : text.slice(0, 200);
      console.error(`[SUMIT] ${path} HTTP ${res.status}: ${msg}`);
      return { ok: false, error: msg || `HTTP ${res.status}` };
    }
    if (!sumitOk(envelope)) {
      const msg = sumitErrorMessage(envelope);
      console.error(`[SUMIT] ${path} failed: ${msg}`);
      return { ok: false, error: msg };
    }
    return { ok: true, data: ((envelope as { Data?: T } | null)?.Data ?? null) as T };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? "timeout" : err.message) : String(err);
    console.error(`[SUMIT] ${path} error: ${msg}`);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// POST /billing/payments/beginredirect/ → the payment page URL
export async function sumitBeginRedirect(body: Record<string, unknown>): Promise<SumitResult<string>> {
  const r = await sumitPost<{ RedirectURL?: string | null }>("/billing/payments/beginredirect/", body);
  if (!r.ok) return r;
  const url = r.data?.RedirectURL;
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: "SUMIT returned no payment page URL" };
  return { ok: true, data: url };
}

// POST /billing/payments/get/ → the payment as SUMIT recorded it (the only proof of payment we accept)
export async function sumitGetPayment(paymentId: number): Promise<SumitResult<SumitPayment | null>> {
  const creds = sumitCredentials();
  if (!creds) return { ok: false, error: "SUMIT not configured" };
  const r = await sumitPost<{ Payment?: SumitPayment | null }>("/billing/payments/get/", { Credentials: creds, PaymentID: paymentId });
  if (!r.ok) return r;
  return { ok: true, data: r.data?.Payment ?? null };
}

// POST /billing/payments/list/ → valid payments in a window (reconciliation of buyers who never came back)
export async function sumitListPayments(from: Date, to: Date, maxPages = 10): Promise<SumitResult<SumitPayment[]>> {
  const creds = sumitCredentials();
  if (!creds) return { ok: false, error: "SUMIT not configured" };
  const all: SumitPayment[] = [];
  let startIndex = 0;
  for (let page = 0; page < maxPages; page++) {
    const r = await sumitPost<{ Payments?: SumitPayment[] | null; HasNextPage?: boolean }>("/billing/payments/list/", {
      Credentials: creds,
      Date_From: from.toISOString(),
      Date_To: to.toISOString(),
      Valid: true,
      StartIndex: startIndex,
    });
    if (!r.ok) return r;
    const rows = r.data?.Payments || [];
    all.push(...rows);
    if (!r.data?.HasNextPage || rows.length === 0) break;
    startIndex += rows.length;
  }
  return { ok: true, data: all };
}
