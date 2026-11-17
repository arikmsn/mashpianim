// Which phones have an existing WhatsApp chat with our number (owner, 2026-11-17): the only ones a GreenAPI send
// is safe for. Known = the account was created before the 2026-11-12 restriction (every login code went by
// WhatsApp then) or the message log holds a WhatsApp we sent them. Server-only; phones are stored with and
// without a leading "+", so everything is matched by digits.
import type { SupabaseClient } from "@supabase/supabase-js";
import { WHATSAPP_KNOWN_BEFORE, isKnownWhatsAppUser, phoneDigits } from "@/lib/otp-channel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

function variants(digits: string): string[] {
  return [digits, `+${digits}`];
}

// One lookup for many phones (the digests): digits → known?
export async function knownWhatsAppPhones(admin: Admin, phones: (string | null | undefined)[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const digitsList = [...new Set(phones.map(phoneDigits).filter((d) => d.length >= 8))];
  if (digitsList.length === 0) return out;
  const all = digitsList.flatMap(variants);
  const [users, sends] = await Promise.all([
    admin.from("users").select("phone, created_at").in("phone", all),
    admin.from("message_log").select("phone").eq("channel", "whatsapp").eq("status", "sent").in("phone", all),
  ]);
  const createdAt = new Map<string, string>();
  for (const u of (users.data || []) as { phone: string; created_at: string }[]) {
    const d = phoneDigits(u.phone);
    const prev = createdAt.get(d);
    if (!prev || Date.parse(u.created_at) < Date.parse(prev)) createdAt.set(d, u.created_at);
  }
  const sent = new Set(((sends.data || []) as { phone: string }[]).map((s) => phoneDigits(s.phone)));
  for (const d of digitsList) {
    out.set(d, isKnownWhatsAppUser({ createdAt: createdAt.get(d) || null, whatsappSent: sent.has(d) }, WHATSAPP_KNOWN_BEFORE));
  }
  return out;
}

export async function isKnownWhatsAppPhone(admin: Admin, phone: string): Promise<boolean> {
  const map = await knownWhatsAppPhones(admin, [phone]);
  return map.get(phoneDigits(phone)) === true;
}
