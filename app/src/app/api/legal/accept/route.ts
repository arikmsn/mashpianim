import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/notifications";
import { getTermsVersion } from "@/lib/site-content-server";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST — the signed-in account accepted the current terms (the gate in the app). Stamps users.terms_accepted_at /
// terms_version (migration 017) and, when the separate checkbox was ticked ({ video_promo: true }), the consent to
// the platform using uploaded videos for its own promotion (migration 028). A later TERMS_VERSION asks again.
// A body without video_promo (an older cached app) still records the terms; the gate then asks for the consent.
export async function POST(request: Request) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { video_promo?: unknown };
  const videoPromo = body?.video_promo === true;

  const { data: row, error: findError } = await admin.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (findError) {
    console.error("[legal/accept] lookup error:", findError.message);
    return NextResponse.json({ error: "שגיאה בשמירת האישור" }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  const userId = (row as { id: string }).id;

  // The current version: the admin's stored one (bumped on a material change in /admin/content) or the constant
  const version = await getTermsVersion();
  const result = await recordLegalAcceptance(admin, { userId, version, videoPromo });
  if (!result.ok) {
    console.error("[legal/accept] update error:", result.error);
    return NextResponse.json({ error: "שגיאה בשמירת האישור" }, { status: 500 });
  }

  after(async () => {
    try {
      await logActivity({
        actorId: userId,
        action: "terms_accepted",
        entityType: "user",
        entityId: userId,
        details: { version, video_promo: result.videoPromoRecorded, via: "gate" },
      });
    } catch (err) {
      console.error("[legal/accept] activity log failed:", err);
    }
  });

  return NextResponse.json({
    success: true,
    terms_accepted_at: result.at,
    terms_version: version,
    ...(result.videoPromoRecorded ? { video_promo_consent_at: result.at, video_promo_consent_version: version } : {}),
  });
}
