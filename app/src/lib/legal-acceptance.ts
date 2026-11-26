import type { SupabaseClient } from "@supabase/supabase-js";

// Writes an account's acceptance of the legal documents (owner, 2026-11-26): the terms (users.terms_accepted_at /
// terms_version, migration 017) and, separately, the consent to the platform using uploaded videos to promote
// itself (users.video_promo_consent_at / video_promo_consent_version, migration 028). Both are stamped with the
// TERMS_VERSION in force, so a later material change asks again.
//
// Called by the registration route (the checkboxes on the last step) and by POST /api/legal/accept (the in-app
// gate). Until migration 028 is applied the consent columns are missing: the terms are still recorded and the
// consent is reported as not recorded, so a deploy ahead of the migration never blocks a registration or the gate.

export interface LegalAcceptanceInput {
  // users.id
  userId: string;
  version: string;
  videoPromo: boolean;
  now?: Date;
}

export interface LegalAcceptanceResult {
  ok: boolean;
  at: string;
  version: string;
  videoPromoRecorded: boolean;
  error?: string;
}

function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /video_promo_consent/.test(err.message || "");
}

export async function recordLegalAcceptance(admin: SupabaseClient, input: LegalAcceptanceInput): Promise<LegalAcceptanceResult> {
  const at = (input.now || new Date()).toISOString();
  const terms = { terms_accepted_at: at, terms_version: input.version };
  const withConsent = input.videoPromo ? { ...terms, video_promo_consent_at: at, video_promo_consent_version: input.version } : terms;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = () => admin.from("users") as any;
  const first = await users().update(withConsent).eq("id", input.userId);
  if (!first.error) return { ok: true, at, version: input.version, videoPromoRecorded: input.videoPromo };

  if (input.videoPromo && isMissingColumn(first.error)) {
    console.warn("[legal] video promo consent columns missing (migration 028 not applied); recording the terms only");
    const second = await users().update(terms).eq("id", input.userId);
    if (!second.error) return { ok: true, at, version: input.version, videoPromoRecorded: false };
    return { ok: false, at, version: input.version, videoPromoRecorded: false, error: second.error.message };
  }
  return { ok: false, at, version: input.version, videoPromoRecorded: false, error: first.error.message };
}
