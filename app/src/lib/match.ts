import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { mapMatchError } from "@/lib/match-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export const MIN_PORTFOLIO_VIDEOS = 5;
export const APP_URL = "https://www.mashpian.online";

export async function countPortfolioVideos(admin: Admin, creatorUserId: string): Promise<number> {
  const { count } = await admin
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorUserId)
    .is("connection_id", null);
  return count || 0;
}

export function portfolioGateError(count: number) {
  const missing = Math.max(0, MIN_PORTFOLIO_VIDEOS - count);
  return `כדי לסמן לב ולאשר שיתופי פעולה צריך ${MIN_PORTFOLIO_VIDEOS} סרטונים בתיק העבודות. יש לך ${count} — העלו עוד ${missing}.`;
}

export function buildBriefMessage(product: {
  name: string;
  price?: number | null;
  product_type?: string | null;
  description?: string | null;
}): string {
  const kind = product.product_type === "digital" ? "דיגיטלי" : "פיזי";
  return [
    `📦 בריף — ${product.name}`,
    `שווי: ₪${Number(product.price) || 0} · ${kind}`,
    ``,
    `מה המוצר: ${product.description?.trim() || "(העסק ישלים)"}`,
    `למי הוא מתאים: (העסק ישלים)`,
    ``,
    `3 דברים שחובה להגיד:`,
    `1.`,
    `2.`,
    `3.`,
    `מה לא להגיד או להראות: (העסק ישלים)`,
    ``,
    `פורמט: וידאו 15–45 שנ' · 9:16 · דיבור למצלמה · כתוביות בעברית`,
    `יעד להעלאה: עד 10 ימים מקבלת המוצר`,
    `זכויות שימוש: העסק רשאי להשתמש בסרטון בכל הערוצים שלו`,
  ].join("\n");
}

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
}) {
  await createNotification({
    userId: params.creatorUserId,
    type: "heart_received",
    title: "💗 מישהו סימן אותך!",
    body: `${params.brandName} מתעניינים בך למוצר "${params.productName}". אשרו כדי לפתוח צ'אט.`,
    data: { connectionId: params.connectionId },
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
}) {
  await createNotification({
    userId: params.brandUserId,
    type: "heart_received",
    title: "💗 יוצר/ת סימן/ה אתכם!",
    body: `${params.creatorName} רוצה ליצור סרטון ל"${params.productName}". אשרו כדי לפתוח צ'אט.`,
    data: { connectionId: params.connectionId },
  });
  await sendWhatsApp(
    params.brandPhone,
    `💗 *${params.creatorName}* סימן/ה אתכם!\n\nרוצה ליצור סרטון למוצר *${params.productName}*.\n\nצפו בפרופיל ואשרו:\n${APP_URL}/brand/connections`
  );
}

type MatchResult = { ok: true } | { ok: false; error: string; status: number };

// Turns a pending heart into a match: the credit deduction and the status change happen atomically in the
// match_connection() database function (row locks, single transaction); this then opens the chat and notifies.
export async function performMatch(admin: Admin, connectionId: string, actorUserId: string): Promise<MatchResult> {
  const { data: raw } = await admin
    .from("connections")
    .select(`
      id, status, brand_id, creator_id, credit_deducted, initiated_by,
      products(name, price, description, product_type,
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

  const { error: matchError } = await admin.rpc("match_connection", { p_connection_id: connectionId });
  if (matchError) {
    const mapped = mapMatchError(matchError.message);
    if (mapped.status === 500) console.error("[match] match_connection error:", matchError.message);
    return { ok: false, ...mapped };
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
      text: buildBriefMessage({
        name: productName,
        price: product?.price,
        product_type: product?.product_type,
        description: product?.description,
      }),
      is_system: true,
    },
  ] as any);

  const data = { connectionId };
  await Promise.all([
    createNotification({
      userId: creatorUser.id,
      type: "match",
      title: "🎉 יש מאטץ'!",
      body: `את/ה ו-${brandName} עובדים יחד על "${productName}". הצ'אט פתוח.`,
      data,
    }),
    createNotification({
      userId: brandUser.id,
      type: "match",
      title: "🎉 יש מאטץ'!",
      body: `${creatorName} אישר/ה — אתם עובדים יחד על "${productName}". שלחו את המוצר.`,
      data,
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
