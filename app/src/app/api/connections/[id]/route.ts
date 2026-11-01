import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { filterContactInfo } from "@/lib/moderation/chat-filter";
import { notifyConnectionStatusChange, logActivity } from "@/lib/notifications";

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

  const { data, error } = await admin
    .from("connections")
    .select(`
      *,
      products(name, image_url, price, description, product_type, digital_access_type, digital_access_instructions, digital_access_duration_days, shipping_policy),
      creator_profiles!connections_creator_id_fkey(id, user_id, bio, categories, level, hearts, completed_connections, users(full_name, avatar_url, phone)),
      brand_profiles!connections_brand_id_fkey(id, user_id, shop_name, logo_url, users(full_name, avatar_url))
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ connection: data });
}

// State machine: which transitions are valid and who can trigger them
const validTransitions: Record<string, { targets: string[]; allowedRoles: string[] }> = {
  pending:             { targets: ["approved", "rejected"], allowedRoles: ["brand", "admin"] },
  approved:            { targets: ["shipped", "cancelled"], allowedRoles: ["brand", "admin"] },
  shipped:             { targets: ["delivered", "cancelled"], allowedRoles: ["creator", "admin"] },
  delivered:           { targets: ["filming"], allowedRoles: ["creator", "admin"] },
  filming:             { targets: ["uploaded"], allowedRoles: ["creator", "admin"] },
  uploaded:            { targets: ["in_review"], allowedRoles: ["admin"] },
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

  // Get current user info
  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

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

  // Status-specific logic
  switch (newStatus) {
    case "approved": {
      updates.approved_at = now.toISOString();
      updates.ship_deadline = new Date(now.getTime() + 7 * 86400000).toISOString();
      updates.delivery_type = product?.product_type || "physical";

      // Deduct credit from brand
      if (brandProfile && !(connection as any).credit_deducted) {
        const currentUsed = brandProfile.used_credits || 0;
        const currentTotal = brandProfile.total_credits || 0;
        if (currentUsed >= currentTotal) {
          return NextResponse.json({ error: "אין קרדיטים זמינים" }, { status: 400 });
        }
        await admin
          .from("brand_profiles")
          .update({ used_credits: currentUsed + 1 } as any)
          .eq("id", (connection as any).brand_id);
        updates.credit_deducted = true;
      }
      break;
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
      updates.film_deadline = new Date(now.getTime() + 10 * 86400000).toISOString();
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
      updates.review_deadline = new Date(now.getTime() + 7 * 86400000).toISOString();
      break;
    }

    case "completed": {
      updates.completed_at = now.toISOString();

      // Mark videos as downloadable
      await admin
        .from("videos")
        .update({ is_downloadable: true } as any)
        .eq("connection_id", id)
        .eq("status", "approved");

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
      updates.revision_notes = revision_notes;
      updates.revision_count = ((connection as any).revision_count || 0) + 1;

      // Max 2 revisions
      if ((connection as any).revision_count >= 2) {
        return NextResponse.json({ error: "הגעתם למקסימום תיקונים (2). יש לאשר או לבטל." }, { status: 400 });
      }
      break;
    }

    case "rejected": {
      if (rejection_reason) updates.rejection_reason = rejection_reason;
      break;
    }

    case "cancelled": {
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
  if (creatorUser && brandUser) {
    await notifyConnectionStatusChange(newStatus, {
      connectionId: id,
      productName: product?.name || "",
      creatorName: (creatorUser as any).full_name || "יוצר",
      brandName: brandProfile?.shop_name || (brandUser as any).full_name || "עסק",
      creatorUserId: (creatorUser as any).id,
      brandUserId: (brandUser as any).id,
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
