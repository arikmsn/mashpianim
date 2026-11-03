import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { filterContactInfo } from "@/lib/moderation/chat-filter";
import { notifyConnectionStatusChange, logActivity, createNotification, notificationData } from "@/lib/notifications";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { performMatch, countPortfolioVideos, portfolioGateError, MIN_PORTFOLIO_VIDEOS } from "@/lib/match";
import { isConnectionParticipant } from "@/lib/authz";
import { getTimelineSettings } from "@/lib/settings";
import { isChatOpen } from "@/lib/connection-flow";

type RouteContext = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // `type` here is the role this session is signed in as (an admin signed in as a creator is a creator)
  const viewerGet = await resolveViewer(admin, user.id, await readActiveRole());
  const dbUser = viewerGet ? { id: viewerGet.userId, type: viewerGet.role } : null;
  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("connections")
    .select(`
      *,
      products(name, image_url, price, description, product_type, digital_access_type, digital_access_instructions, digital_access_duration_days, shipping_policy),
      creator_profiles!connections_creator_id_fkey(id, user_id, bio, categories, level, hearts, completed_connections, users(full_name, avatar_url)),
      brand_profiles!connections_brand_id_fkey(id, user_id, shop_name, logo_url, users(full_name, avatar_url))
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  // Only the two parties (or an admin) may see a connection and its chat
  const parties = {
    creatorUserId: (data as any).creator_profiles?.user_id,
    brandUserId: (data as any).brand_profiles?.user_id,
  };
  if ((dbUser as any).type !== "admin" && !isConnectionParticipant(parties, (dbUser as any).id)) {
    return NextResponse.json({ error: "אין הרשאה לחיבור זה" }, { status: 403 });
  }

  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("connection_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ connection: data, messages: messages || [] });
}

// State machine: which transitions are valid and who can trigger them
const validTransitions: Record<string, { targets: string[]; allowedRoles: string[] }> = {
  // pending = a heart from one side; who may answer/cancel is resolved per connection below
  pending:             { targets: ["approved", "rejected", "cancelled"], allowedRoles: ["brand", "creator", "admin"] },
  approved:            { targets: ["shipped", "cancelled"], allowedRoles: ["brand", "admin"] },
  shipped:             { targets: ["delivered", "cancelled"], allowedRoles: ["creator", "admin"] },
  delivered:           { targets: ["filming"], allowedRoles: ["creator", "admin"] },
  filming:             { targets: ["uploaded"], allowedRoles: ["creator", "admin"] },
  // The brand reviews the deliverable as soon as it is uploaded; an admin may still route it via in_review (FLOW-01)
  uploaded:            { targets: ["in_review", "completed", "revision_requested"], allowedRoles: ["brand", "admin"] },
  in_review:           { targets: ["completed", "revision_requested"], allowedRoles: ["brand", "admin"] },
  revision_requested:  { targets: ["uploaded"], allowedRoles: ["creator", "admin"] },
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Current user — `type` is the role this session is signed in as (creator / brand / admin)
  const viewerPut = await resolveViewer(admin, user.id, await readActiveRole());
  const dbUser = viewerPut ? { id: viewerPut.userId, type: viewerPut.role } : null;

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // Get connection with related data
  const { data: connection } = await admin
    .from("connections")
    .select(`
      *,
      products(name, brand_id, product_type, digital_access_duration_days,
        brand_profiles(user_id, total_credits, used_credits, shop_name, users(id, full_name))),
      creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name))
    `)
    .eq("id", id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  const body = await request.json();
  const {
    status: newStatus,
    rejection_reason,
    revision_notes,
    tracking_number,
    tracking_url,
    digital_access_value,
    delivery_proof_url,
  } = body;

  if (!newStatus) {
    return NextResponse.json({ error: "סטטוס חסר" }, { status: 400 });
  }

  const currentStatus = (connection as any).status;
  const transition = validTransitions[currentStatus];

  if (!transition || !transition.targets.includes(newStatus)) {
    return NextResponse.json(
      { error: `לא ניתן לעבור מ-${currentStatus} ל-${newStatus}` },
      { status: 400 }
    );
  }

  // Check role permission
  const userType = (dbUser as any).type;
  if (!transition.allowedRoles.includes(userType)) {
    return NextResponse.json({ error: "אין הרשאה לפעולה זו" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status: newStatus };
  const now = new Date();
  const product = (connection as any).products;
  const brandProfile = product?.brand_profiles;
  const creatorProfile = (connection as any).creator_profiles;
  const initiatedBy: "creator" | "brand" = (connection as any).initiated_by === "brand" ? "brand" : "creator";

  // The acting user must be a party to this connection
  if (userType === "brand" && brandProfile?.user_id !== (dbUser as any).id) {
    return NextResponse.json({ error: "אין הרשאה לחיבור זה" }, { status: 403 });
  }
  if (userType === "creator" && creatorProfile?.user_id !== (dbUser as any).id) {
    return NextResponse.json({ error: "אין הרשאה לחיבור זה" }, { status: 403 });
  }

  // Hearts: only the other side can answer, only the sender can withdraw
  if (currentStatus === "pending" && userType !== "admin") {
    const responder = initiatedBy === "brand" ? "creator" : "brand";
    if (newStatus === "cancelled" && userType !== initiatedBy) {
      return NextResponse.json({ error: "רק מי ששלח את הלב יכול לבטל אותו" }, { status: 403 });
    }
    if ((newStatus === "approved" || newStatus === "rejected") && userType !== responder) {
      return NextResponse.json({ error: "ממתינים לתשובת הצד השני" }, { status: 403 });
    }
    if (newStatus === "approved" && userType === "creator") {
      const count = await countPortfolioVideos(admin, (dbUser as any).id);
      if (count < MIN_PORTFOLIO_VIDEOS) {
        return NextResponse.json({ error: portfolioGateError(count), code: "portfolio_gate", count }, { status: 403 });
      }
    }
  }

  // Deadlines and the revision limit come from the admin settings (FLOW-02)
  const timelines = await getTimelineSettings(admin);

  // Status-specific logic
  switch (newStatus) {
    case "approved": {
      const result = await performMatch(admin, id, (dbUser as any).id);
      if (!result.ok) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
      }
      await logActivity({
        actorId: (dbUser as any).id,
        action: "connection_matched",
        entityType: "connection",
        entityId: id,
        details: { initiatedBy },
      });
      return NextResponse.json({ success: true, status: "approved" });
    }

    case "shipped": {
      updates.shipped_at = now.toISOString();
      updates.deliver_deadline = new Date(now.getTime() + 14 * 86400000).toISOString();
      if (tracking_number) updates.tracking_number = tracking_number;
      if (tracking_url) updates.tracking_url = tracking_url;

      // For digital products, store the access value
      if ((connection as any).delivery_type === "digital" || product?.product_type === "digital") {
        if (!digital_access_value) {
          return NextResponse.json({ error: "חובה לספק פרטי גישה למוצר דיגיטלי" }, { status: 400 });
        }
        updates.digital_access_value = digital_access_value;
        if (product?.digital_access_duration_days) {
          updates.digital_access_expires_at = new Date(
            now.getTime() + product.digital_access_duration_days * 86400000
          ).toISOString();
        }
      }
      break;
    }

    case "delivered": {
      updates.delivered_at = now.toISOString();
      updates.delivery_confirmed_at = now.toISOString();
      updates.film_deadline = new Date(now.getTime() + timelines.filming_days * 86400000).toISOString();
      if (delivery_proof_url) updates.delivery_proof_url = delivery_proof_url;
      break;
    }

    case "filming": {
      updates.filmed_at = now.toISOString();
      break;
    }

    case "uploaded": {
      // filmed_at already set, no deadline change needed here
      break;
    }

    case "in_review": {
      updates.review_deadline = new Date(now.getTime() + timelines.review_days * 86400000).toISOString();
      break;
    }

    case "completed": {
      updates.completed_at = now.toISOString();

      // The brand's approval is the approval: the deliverables become approved and downloadable
      await admin
        .from("videos")
        .update({ status: "approved", approved_at: now.toISOString(), is_downloadable: true } as any)
        .eq("connection_id", id)
        .neq("status", "rejected");

      // Close the chat with a visible marker
      await admin.from("messages").insert({
        connection_id: id,
        sender_id: (dbUser as any).id,
        text: "✅ הסרטון אושר והחיבור הושלם. הצ'אט סגור לקריאה בלבד.",
        is_system: true,
      } as any);

      // Increment creator's completed connections
      if (creatorProfile) {
        const { data: cp } = await admin
          .from("creator_profiles")
          .select("completed_connections")
          .eq("id", (connection as any).creator_id)
          .single();
        if (cp) {
          await admin
            .from("creator_profiles")
            .update({ completed_connections: ((cp as any).completed_connections || 0) + 1 } as any)
            .eq("id", (connection as any).creator_id);
        }
      }
      break;
    }

    case "revision_requested": {
      if (!revision_notes) {
        return NextResponse.json({ error: "חובה לציין מה לתקן" }, { status: 400 });
      }
      const usedRevisions = (connection as any).revision_count || 0;
      if (usedRevisions >= timelines.max_revisions) {
        return NextResponse.json(
          { error: `הגעתם למקסימום תיקונים (${timelines.max_revisions}). יש לאשר או לבטל.` },
          { status: 400 }
        );
      }
      updates.revision_notes = revision_notes;
      updates.revision_count = usedRevisions + 1;

      // The uploaded deliverable goes back to the creator with the notes
      await admin
        .from("videos")
        .update({ status: "revision_requested", revision_notes } as any)
        .eq("connection_id", id)
        .eq("status", "pending");
      break;
    }

    case "rejected": {
      if (rejection_reason) updates.rejection_reason = rejection_reason;
      break;
    }

    case "cancelled": {
      // A matched connection had a chat — leave a closing marker in it
      if ((connection as any).approved_at) {
        await admin.from("messages").insert({
          connection_id: id,
          sender_id: (dbUser as any).id,
          text: "החיבור בוטל. הצ'אט סגור לקריאה בלבד.",
          is_system: true,
        } as any);
      }
      // Refund credit if it was deducted
      if ((connection as any).credit_deducted && brandProfile) {
        const currentUsed = brandProfile.used_credits || 0;
        await admin
          .from("brand_profiles")
          .update({ used_credits: Math.max(0, currentUsed - 1) } as any)
          .eq("id", (connection as any).brand_id);
        updates.credit_deducted = false;
      }
      break;
    }
  }

  const { error } = await admin
    .from("connections")
    .update(updates as any)
    .eq("id", id);

  if (error) {
    console.error("[connections] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  // Send notifications
  const creatorUser = creatorProfile?.users;
  const brandUser = brandProfile?.users;
  const productId = ((connection as any).product_id as string | null) || null;
  if (newStatus === "rejected" && initiatedBy === "brand" && brandUser) {
    await createNotification({
      userId: (brandUser as any).id,
      type: "heart_declined",
      title: "היוצר/ת דחה/תה את הלב",
      body: `${(creatorUser as any)?.full_name || "היוצר/ת"} לא מעוניין/ת כרגע ב"${product?.name || "המוצר"}". הקרדיט לא נוצל — אפשר לבחור יוצר/ת אחר/ת.`,
      data: notificationData(id, productId, "brand"),
    });
  } else if (newStatus === "cancelled" && currentStatus === "pending" && creatorUser && brandUser) {
    const target = initiatedBy === "brand" ? creatorUser : brandUser;
    await createNotification({
      userId: (target as any).id,
      type: "heart_withdrawn",
      title: "לב בוטל",
      body: `הלב למוצר "${product?.name || ""}" בוטל על ידי הצד השני.`,
      data: notificationData(id, productId, initiatedBy === "brand" ? "creator" : "brand"),
    });
  } else if (creatorUser && brandUser) {
    await notifyConnectionStatusChange(newStatus, {
      connectionId: id,
      productName: product?.name || "",
      creatorName: (creatorUser as any).full_name || "יוצר",
      brandName: brandProfile?.shop_name || (brandUser as any).full_name || "עסק",
      creatorUserId: (creatorUser as any).id,
      brandUserId: (brandUser as any).id,
      productId,
    });
  }

  // Log activity
  await logActivity({
    actorId: (dbUser as any).id,
    action: `connection_${newStatus}`,
    entityType: "connection",
    entityId: id,
    details: { from: currentStatus, to: newStatus },
  });

  return NextResponse.json({ success: true, status: newStatus });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const { text } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "הודעה ריקה" }, { status: 400 });
  }

  const moderation = filterContactInfo(text.trim());
  if (moderation.blocked) {
    return NextResponse.json({ error: moderation.reason }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: userData } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const { data: conn } = await admin
    .from("connections")
    .select(`
      status,
      creator_profiles!connections_creator_id_fkey(user_id),
      brand_profiles!connections_brand_id_fkey(user_id)
    `)
    .eq("id", id)
    .single();

  if (!conn) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  // Only the two parties may write into the chat
  const parties = {
    creatorUserId: (conn as any).creator_profiles?.user_id,
    brandUserId: (conn as any).brand_profiles?.user_id,
  };
  if (!isConnectionParticipant(parties, (userData as any).id)) {
    return NextResponse.json({ error: "אין הרשאה לחיבור זה" }, { status: 403 });
  }

  if (!isChatOpen((conn as any).status)) {
    return NextResponse.json({ error: "הצ'אט סגור — החיבור הסתיים", code: "chat_closed" }, { status: 400 });
  }

  // Ordinary chat can never produce a system message; sender is always the session user
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      connection_id: id,
      sender_id: (userData as any).id,
      text: text.trim(),
      is_system: false,
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[messages] insert error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message });
}
