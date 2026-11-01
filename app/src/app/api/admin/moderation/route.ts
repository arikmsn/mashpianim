import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";

export async function GET() {
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  // Pending videos with connection and creator info
  const { data: pendingVideos, error: vErr } = await supabase
    .from("videos")
    .select(`
      *,
      connections(
        id, status, product_id,
        products(name, image_url),
        creator_profiles!connections_creator_id_fkey(user_id, users(full_name, avatar_url)),
        brand_profiles!connections_brand_id_fkey(user_id, shop_name, users(full_name))
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (vErr) {
    console.error("[moderation] videos error:", vErr);
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // Flagged messages (containing moderation_flags or reported)
  const { data: flaggedMessages } = await supabase
    .from("messages")
    .select(`
      *,
      connections(
        id,
        creator_profiles!connections_creator_id_fkey(users(full_name)),
        brand_profiles!connections_brand_id_fkey(shop_name, users(full_name))
      )
    `)
    .eq("is_system", true)
    .ilike("text", "%חסימת%")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    pendingVideos: pendingVideos || [],
    flaggedMessages: flaggedMessages || [],
  });
}

export async function PUT(request: NextRequest) {
  const { isAdmin, userId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { videoId, action, revision_notes } = body;

  if (!videoId || !action) {
    return NextResponse.json({ error: "חסר videoId או action" }, { status: 400 });
  }

  if (!["approve", "reject", "revision"].includes(action)) {
    return NextResponse.json({ error: "פעולה לא תקינה" }, { status: 400 });
  }

  // Get video with connection info
  const { data: video } = await supabase
    .from("videos")
    .select(`
      *,
      connections(
        id, status, creator_id, brand_id, revision_count,
        products(name),
        creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name)),
        brand_profiles!connections_brand_id_fkey(user_id, shop_name, users(id, full_name))
      )
    `)
    .eq("id", videoId)
    .single();

  if (!video) {
    return NextResponse.json({ error: "סרטון לא נמצא" }, { status: 404 });
  }

  const conn = (video as any).connections;
  const creatorUser = conn?.creator_profiles?.users;
  const brandUser = conn?.brand_profiles?.users;

  // Get admin user id from users table
  const { data: adminUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", userId)
    .single();

  if (action === "approve") {
    // Approve video
    await supabase
      .from("videos")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: (adminUser as any)?.id || null,
      } as any)
      .eq("id", videoId);

    // Move connection to in_review (brand review)
    if (conn?.status === "uploaded") {
      await supabase
        .from("connections")
        .update({
          status: "in_review",
          review_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        } as any)
        .eq("id", conn.id);

      // Notify brand
      if (brandUser) {
        await createNotification({
          userId: (brandUser as any).id,
          type: "video_ready_for_review",
          title: "סרטון מוכן לסקירה",
          body: `סרטון חדש עבור "${conn.products?.name}" מוכן לצפייה ואישור.`,
          data: { connectionId: conn.id },
        });
      }
    }

    await logActivity({
      actorId: (adminUser as any)?.id,
      action: "video_approved",
      entityType: "video",
      entityId: videoId,
    });
  } else if (action === "revision") {
    if (!revision_notes) {
      return NextResponse.json({ error: "חובה לציין מה לתקן" }, { status: 400 });
    }

    await supabase
      .from("videos")
      .update({
        status: "revision_requested",
        revision_notes,
      } as any)
      .eq("id", videoId);

    // Move connection back to revision_requested
    if (conn) {
      const revCount = (conn.revision_count || 0) + 1;
      await supabase
        .from("connections")
        .update({
          status: "revision_requested",
          revision_notes,
          revision_count: revCount,
        } as any)
        .eq("id", conn.id);

      if (creatorUser) {
        await createNotification({
          userId: (creatorUser as any).id,
          type: "revision_requested",
          title: "נדרש תיקון בסרטון",
          body: `אדמין ביקש תיקון: ${revision_notes}`,
          data: { connectionId: conn.id },
        });
      }
    }

    await logActivity({
      actorId: (adminUser as any)?.id,
      action: "video_revision_requested",
      entityType: "video",
      entityId: videoId,
      details: { revision_notes },
    });
  } else if (action === "reject") {
    await supabase
      .from("videos")
      .update({ status: "revision_requested", revision_notes: revision_notes || "הסרטון נדחה" } as any)
      .eq("id", videoId);

    await logActivity({
      actorId: (adminUser as any)?.id,
      action: "video_rejected",
      entityType: "video",
      entityId: videoId,
    });
  }

  return NextResponse.json({ success: true, action });
}
