import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { createNotification, notificationData, logActivity } from "@/lib/notifications";
import { getTimelineSettings } from "@/lib/settings";
import { isChatOpen } from "@/lib/connection-flow";
import { sanitizeBriefData, type BriefSnapshot } from "@/lib/brief";
import { CHAT_EVENT_TEXTS } from "@/lib/chat";

type RouteContext = { params: Promise<{ id: string }> };

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// The brief inside the chat. POST { action: "post" } (brand): a card with the product's current brief goes
// into the chat and the creator's earlier approval is reset. POST { action: "approve" } (creator): the
// creator approves the latest card; "אישרתי את הבריף" is written in her name and the shipping clock starts.
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "approve" ? "approve" : body?.action === "post" ? "post" : null;
  if (!action) return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const { data: raw } = await admin
    .from("connections")
    .select(`
      id, status, brief_posted_at, brief_approved_at, shipped_at, product_id,
      products(id, name, brief, brief_data, brand_profiles(user_id, shop_name, users(id, full_name))),
      creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name))
    `)
    .eq("id", id)
    .single();
  const conn = raw as any;
  if (!conn) return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  if (!isChatOpen(conn.status)) return NextResponse.json({ error: "הצ'אט סגור — החיבור הסתיים", code: "chat_closed" }, { status: 400 });

  const brandUserId = conn.products?.brand_profiles?.user_id as string | undefined;
  const creatorUserId = conn.creator_profiles?.user_id as string | undefined;
  const brandUser = conn.products?.brand_profiles?.users;
  const creatorUser = conn.creator_profiles?.users;
  const productName = conn.products?.name || "המוצר";
  const now = new Date().toISOString();

  if (action === "post") {
    const isBrand = viewer.role === "brand" && viewer.userId === brandUserId;
    if (!isBrand && viewer.role !== "admin") return NextResponse.json({ error: "רק העסק שולח את הבריף" }, { status: 403 });

    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("connection_id", id).eq("kind", "brief");
    const snapshot: BriefSnapshot = {
      product_name: productName,
      brief_data: sanitizeBriefData(conn.products?.brief_data),
      brief: conn.products?.brief || null,
      version: (count || 0) + 1,
    };
    const { data: message, error } = await admin
      .from("messages")
      .insert({
        connection_id: id,
        sender_id: brandUserId || viewer.userId,
        text: snapshot.version > 1 ? `📋 הבריף עודכן (גרסה ${snapshot.version})` : "📋 הבריף לסרטון",
        is_system: false,
        kind: "brief",
        data: snapshot,
      } as any)
      .select()
      .single();
    if (error) {
      console.error("[brief] post error:", error.message);
      return NextResponse.json({ error: "שגיאה בשליחת הבריף" }, { status: 500 });
    }
    await admin.from("connections").update({ brief_posted_at: now, brief_approved_at: null } as any).eq("id", id);
    // Notification + activity log after the response (the brand waits only for the card itself)
    after(async () => {
      try {
        if (creatorUser) {
          await createNotification({
            userId: creatorUser.id,
            type: snapshot.version > 1 ? "brief_updated" : "brief_posted",
            title: snapshot.version > 1 ? "📋 הבריף עודכן" : "📋 הבריף לסרטון הגיע",
            body: `${conn.products?.brand_profiles?.shop_name || "העסק"} ${snapshot.version > 1 ? "עדכנו את הבריף" : "שלחו את הבריף"} ל"${productName}". קראי ואשרי אותו בצ'אט.`,
            data: notificationData(id, conn.product_id, "creator"),
          });
        }
        await logActivity({ actorId: viewer.userId, action: "brief_posted", entityType: "connection", entityId: id, details: { version: snapshot.version } });
      } catch (err) {
        console.error("[brief] post-response notifications failed:", err);
      }
    });
    return NextResponse.json({ success: true, message, version: snapshot.version });
  }

  // approve
  const isCreator = viewer.role === "creator" && viewer.userId === creatorUserId;
  if (!isCreator && viewer.role !== "admin") return NextResponse.json({ error: "רק היוצר/ת מאשר/ת את הבריף" }, { status: 403 });
  if (!conn.brief_posted_at) return NextResponse.json({ error: "העסק עדיין לא שלח בריף" }, { status: 400 });
  if (conn.brief_approved_at) return NextResponse.json({ error: "הבריף כבר אושר" }, { status: 400 });

  const updates: Record<string, unknown> = { brief_approved_at: now };
  // The product's shipping clock runs from the approved brief (the owner's spec), unless it already shipped
  if (conn.status === "approved" && !conn.shipped_at) {
    const timelines = await getTimelineSettings(admin);
    updates.ship_deadline = new Date(Date.now() + timelines.shipping_days * 86400000).toISOString();
  }
  const { error: updateError } = await admin.from("connections").update(updates as any).eq("id", id);
  if (updateError) {
    console.error("[brief] approve error:", updateError.message);
    return NextResponse.json({ error: "שגיאה באישור" }, { status: 500 });
  }
  const { data: message } = await admin
    .from("messages")
    .insert({ connection_id: id, sender_id: creatorUserId || viewer.userId, text: CHAT_EVENT_TEXTS.briefApproved, is_system: false, kind: "event", data: { event: "brief_approved" } } as any)
    .select()
    .single();
  // Notification + activity log after the response (the creator sees her approval land at once)
  after(async () => {
    try {
      if (brandUser) {
        await createNotification({
          userId: brandUser.id,
          type: "brief_approved",
          title: "✅ הבריף אושר",
          body: `${creatorUser?.full_name || "היוצר/ת"} אישר/ה את הבריף ל"${productName}". עכשיו תורכם — שלחו את המוצר.`,
          data: notificationData(id, conn.product_id, "brand"),
        });
      }
      await logActivity({ actorId: viewer.userId, action: "brief_approved", entityType: "connection", entityId: id });
    } catch (err) {
      console.error("[brief] post-response notifications failed:", err);
    }
  });
  return NextResponse.json({ success: true, message, brief_approved_at: now, ship_deadline: updates.ship_deadline || null });
}
