// The log of every SMS / WhatsApp the platform sends (migration 023). Best effort: a failure to log never fails
// the send, and until the migration runs the writes are simply dropped (with one console line).
import { createClient } from "@supabase/supabase-js";

export type MessageChannel = "sms" | "whatsapp";
export type MessageStatus = "sent" | "failed" | "dry";

export interface MessageLogEntry {
  channel: MessageChannel;
  kind: string;
  phone: string;
  userId?: string | null;
  status: MessageStatus;
  providerRef?: string | null;
  meta?: Record<string, unknown> | null;
}

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function isMessageLogMissing(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /message_log/.test(error.message || "") && /not find|does not exist|schema cache/i.test(error.message || "");
}

let warnedMissing = false;

export async function logMessage(entry: MessageLogEntry): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    const { error } = await admin.from("message_log").insert({
      channel: entry.channel,
      kind: entry.kind,
      phone: entry.phone,
      user_id: entry.userId || null,
      status: entry.status,
      provider_ref: entry.providerRef || null,
      meta: entry.meta || null,
    } as any);
    if (error) {
      if (isMessageLogMissing(error)) {
        if (!warnedMissing) {
          warnedMissing = true;
          console.error("[message-log] migration 023 not applied — sends are not being counted");
        }
        return;
      }
      console.error("[message-log] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[message-log] error:", err instanceof Error ? err.message : err);
  }
}
