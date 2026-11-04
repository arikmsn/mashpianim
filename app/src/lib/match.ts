import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification, notificationData } from "@/lib/notifications";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { mapMatchError } from "@/lib/match-errors";
import { buildBriefMessage as composeBrief } from "@/lib/brief";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export const MIN_PORTFOLIO_VIDEOS = 5;
export const APP_URL = "https://www.mashpian.online";

// Portfolio videos that count toward the 5-video gate (ones an admin took down don't)
export async function countPortfolioVideos(admin: Admin, creatorUserId: string): Promise<number> {
  const { count } = await admin
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorUserId)
    .is("connection_id", null)
    .neq("status", "rejected");
  return count || 0;
}

export function portfolioGateError(count: number) {
  const missing = Math.max(0, MIN_PORTFOLIO_VIDEOS - count);
  return `כדי לסמן לב ולאשר שיתופי פעולה צריך ${MIN_PORTFOLIO_VIDEOS} סרטונים בתיק העבודות. יש לך ${count} — העלו עוד ${missing}.`;
}

export { buildBriefMessage } from "@/lib/brief";

async function sendWhatsApp(phone: string | null | undefined, body: string) {
  if (!phone) return;
  const api = getGreenAPI();
  if (!api) return;
  try {
    await api.sendWhatsApp({ to: phone, body });
  } catch {
    // best effort
  }
}

export async function notifyHeartSent(params: {
  creatorUserId: string;
  creatorPhone?: string | null;
  brandName: string;
  productName: string;
  connectionId: string;
  productId?: string | null;
}) {
  await createNotification({
    userId: params.creatorUserId,
    type: "heart_received",
    title: "💗 מישהו סימן אותך!",
    body: `${params.brandName} מתעניינים בך למוצר "${params.productName}". אשרו כדי לפתוח צ'אט.`,
    data: notificationData(params.connectionId, params.productId, "creator"),
  });
  await sendWhatsApp(
    params.creatorPhone,
    `💗 *${params.brandName}* סימנו אותך!\n\nהם רוצים שתצרו סרטון למוצר *${params.productName}*.\n\nהיכנסו לאשר או לדחות:\n${APP_URL}/connections`
  );
}

export async function notifyBrandOfHeart(params: {
  brandUserId: string;
  brandPhone?: string | null;
  creatorName: string;
  productName: string;
  connectionId: string;
  productId?: string | null;
}) {
  await createNotification({
    userId: params.brandUserId,
    type: "heart_received",
    title: "💗 יוצר/ת סימן/ה אתכם!",
    body: `${params.creatorName} רוצה ליצור סרטון ל"${params.productName}". אשרו כדי לפתוח צ'אט.`,
    data: notificationData(params.connectionId, params.productId, "brand"),
  });
  await sendWhatsApp(
    params.brandPhone,
    `💗 *${params.creatorName}* סימן/ה אתכם!\n\nרוצה ליצור סרטון למוצר *${params.productName}*.\n\nצפו בפרופיל ואשרו:\n${APP_URL}/brand/connections`
  );
}

type MatchResult = { ok: true } | { ok: false; error: string; status: number; code?: string };

// Both sides hearted: the connection stays pending with mutual_at set until the brand confirms (and pays).
// `actor` is the side that just completed the pair — the other side is told, and the brand is always asked
// to confirm.
export async function markMutual(
  admin: Admin,
  connectionId: string,
  actor: "creator" | "brand"
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: raw } = await admin
    .from("connections")
    .select(`
      id, status, mutual_at, product_id,
      products(id, name, brand_profiles(id, user_id, shop_name, users(id, full_name, phone))),
      creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name, phone))
    `)
    .eq("id", connectionId)
    .single();
  const conn = raw as any;
  if (!conn) return { ok: false, error: "חיבור לא נמצא", status: 404 };
  if (conn.status !== "pending") return { ok: false, error: "החיבור כבר לא ממתין", status: 400 };
  if (conn.mutual_at) return { ok: false, error: "כבר יש מאטץ' — ממתינים לאישור העסק", status: 400 };

  const { error } = await admin.from("connections").update({ mutual_at: new Date().toISOString() } as any).eq("id", connectionId);
  if (error) {
    console.error("[match] mutual update error:", error.message);
    return { ok: false, error: "שגיאה בעדכון", status: 500 };
  }

  const product = conn.products;
  const brandProfile = product?.brand_profiles;
  const brandUser = brandProfile?.users;
  const creatorUser = conn.creator_profiles?.users;
  const brandName = brandProfile?.shop_name || brandUser?.full_name || "העסק";
  const creatorName = creatorUser?.full_name || "היוצר/ת";
  const productName = product?.name || "המוצר";

  if (brandUser) {
    await createNotification({
      userId: brandUser.id,
      type: "match_ready",
      title: "🎉 יש מאטץ'! אשרו את החיבור",
      body: `${creatorName} ואתם סימנתם זה את זה על "${productName}". אשרו את החיבור כדי לפתוח צ'אט ולשלוח את המוצר (סרטון אחד מהחבילה).`,
      data: notificationData(connectionId, product?.id, "brand"),
    });
    if (actor === "creator") {
      await sendWhatsApp(
        brandUser.phone,
        `🎉 *יש מאטץ'!*\n\n${creatorName} אישר/ה לעבוד איתכם על *${productName}*.\nאשרו את החיבור כדי לפתוח את הצ'אט:\n${APP_URL}/brand/connections?tab=match`
      );
    }
  }
  if (creatorUser && actor === "brand") {
    await createNotification({
      userId: creatorUser.id,
      type: "heart_back",
      title: "💗 העסק סימן אותך בחזרה!",
      body: `${brandName} סימנו אותך בחזרה על "${productName}". ברגע שיאשרו את החיבור ייפתח הצ'אט.`,
      data: notificationData(connectionId, product?.id, "creator"),
    });
  }
  return { ok: true };
}

// Turns a pending heart into a match: the credit deduction and the status change happen atomically in the
// match_connection() database function (row locks, single transaction); this then opens the chat and notifies.
export async function performMatch(admin: Admin, connectionId: string, actorUserId: string): Promise<MatchResult> {
  const { data: raw } = await admin
    .from("connections")
    .select(`
      id, status, brand_id, creator_id, credit_deducted, initiated_by,
      products(id, name, price, description, product_type, brief, brief_data,
        brand_profiles(id, user_id, shop_name, users(id, full_name, phone))),
      creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name, phone))
    `)
    .eq("id", connectionId)
    .single();

  const conn = raw as any;
  if (!conn) return { ok: false, error: "חיבור לא נמצא", status: 404 };
  if (conn.status !== "pending") return { ok: false, error: "החיבור כבר לא ממתין", status: 400 };

  const product = conn.products;
  const brandProfile = product?.brand_profiles;
  const creatorUser = conn.creator_profiles?.users;
  const brandUser = brandProfile?.users;
  if (!brandProfile || !creatorUser || !brandUser) {
    return { ok: false, error: "נתוני חיבור חסרים", status: 500 };
  }

  // A match requires a complete portfolio on the creator's side, whoever approves (CRED-02). Hearts sent
  // before the gate existed, or by brands to not-yet-ready creators, simply wait until the creator gets to 5.
  const creatorVideos = await countPortfolioVideos(admin, creatorUser.id);
  if (creatorVideos < MIN_PORTFOLIO_VIDEOS) {
    return {
      ok: false,
      status: 409,
      code: "creator_not_ready",
      error: `ליוצר/ת יש ${creatorVideos}/${MIN_PORTFOLIO_VIDEOS} סרטונים בתיק העבודות. הלב נשמר — המאטץ' ייפתח כשתיק העבודות יושלם.`,
    };
  }

  // Credit deduction, the product's creator limit (max_creators) and the status flip are checked and applied
  // atomically inside match_connection(); PRODUCT_FULL / NO_CREDITS come back as errors.
  const { error: matchError } = await admin.rpc("match_connection", { p_connection_id: connectionId });
  if (matchError) {
    const mapped = mapMatchError(matchError.message);
    if (mapped.status === 500) console.error("[match] match_connection error:", matchError.message);
    return { ok: false, ...mapped, code: mapped.status === 409 ? "product_full" : undefined };
  }

  const brandName = brandProfile.shop_name || brandUser.full_name || "העסק";
  const creatorName = creatorUser.full_name || "היוצר/ת";
  const productName = product?.name || "המוצר";

  await admin.from("messages").insert([
    {
      connection_id: connectionId,
      sender_id: actorUserId,
      text: `🎉 יש מאטץ'! ${brandName} ו-${creatorName} עובדים יחד על "${productName}". כל התקשורת כאן בצ'אט.`,
      is_system: true,
    },
    {
      connection_id: connectionId,
      sender_id: brandUser.id,
      text: composeBrief({
        name: productName,
        price: product?.price,
        product_type: product?.product_type,
        description: product?.description,
        brief: product?.brief,
        brief_data: product?.brief_data,
      }),
      is_system: true,
    },
  ] as any);

  await Promise.all([
    createNotification({
      userId: creatorUser.id,
      type: "match",
      title: "🎉 יש מאטץ'!",
      body: `את/ה ו-${brandName} עובדים יחד על "${productName}". הצ'אט פתוח.`,
      data: notificationData(connectionId, product?.id, "creator"),
    }),
    createNotification({
      userId: brandUser.id,
      type: "match",
      title: "🎉 יש מאטץ'!",
      body: `${creatorName} אישר/ה — אתם עובדים יחד על "${productName}". שלחו את המוצר.`,
      data: notificationData(connectionId, product?.id, "brand"),
    }),
  ]);

  const otherPhone = actorUserId === creatorUser.id ? brandUser.phone : creatorUser.phone;
  const otherIsBrand = actorUserId === creatorUser.id;
  await sendWhatsApp(
    otherPhone,
    otherIsBrand
      ? `🎉 *יש מאטץ'!*\n\n${creatorName} אישר/ה לעבוד איתכם על *${productName}*.\nהצ'אט פתוח — שלחו את המוצר:\n${APP_URL}/messages`
      : `🎉 *יש מאטץ'!*\n\n${brandName} אישרו לעבוד איתך על *${productName}*.\nהצ'אט פתוח עם הבריף:\n${APP_URL}/messages`
  );

  return { ok: true };
}
