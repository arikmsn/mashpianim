import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateTimeHe } from "./dates.ts";

// A completed sign-in (code verified, registration finished, test login): users.last_login_at moves to
// previous_login_at and takes the time of this login (migration 027). The admin lists show both: "when did this
// account last come in, and the time before that" (owner, 2026-11-24). Never on the way of the login itself:
// any failure is logged and swallowed.
export async function recordLogin(admin: SupabaseClient, userId: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error: readError } = await admin.from("users").select("last_login_at").eq("id", userId).maybeSingle();
    if (readError) {
      console.error("[login] read last_login_at failed:", readError.message);
      return false;
    }
    const previous = (data as { last_login_at?: string | null } | null)?.last_login_at ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("users") as any).update({ previous_login_at: previous, last_login_at: now.toISOString() }).eq("id", userId);
    if (error) {
      console.error("[login] record failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[login] record threw:", err);
    return false;
  }
}

// "24.11.2026, 00:05" in Israel time; "" when unknown
export function loginLabel(iso: string | null | undefined): string {
  return formatDateTimeHe(iso);
}
