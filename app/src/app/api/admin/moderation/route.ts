import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";

// Admin moderation: deliverables awaiting an optional admin pass, flagged chat, and portfolio takedowns (MOD-01).
export async function GET() {
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  // Deliverables not yet reviewed (the brand may approve them directly; the admin can step in)
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
    .not("connection_id", "is", null)
    .order("created_at", { ascending: true });

  if (vErr) {
    console.error("[moderation] videos error:", vErr);
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // Latest portfolio videos (any status) with their creators, so an admin can take content down or restore it
  const { data: portfolioRows } = await supabase
    .from("videos")
    .select("id, creator_id, title, status, thumbnail_url, revision_notes, created_at")
    .is("connection_id", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const creatorIds = Array.from(new Set(((portfolioRows || []) as any[]).map((v) => v.creator_id).filter(Boolean)));
  const { data: creators } = creatorIds.length
    ? await supabase.from("users").select("id, full_name").in("id", creatorIds)
    : { data: [] as any[] };
  const nameById = new Map(((creators || []) as any[]).map((u) => [u.id, u.full_name]));
  const portfolioVideos = ((portfolioRows || []) as any[]).map((v) => ({
    ...v,
    creator_name: nameById.get(v.creator_id) || "יוצר/ת",
  }));

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
    videos: pendingVideos || [],
    pendingVideos: pendingVideos || [],
    portfolioVideos,
    flaggedMessages: flaggedMessages || [],
  });
}

export async function PUT(request: NextRequest) {
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { videoId, action, revision_notes } = body;

  if (!videoId || !action) {
    return NextResponse.json({ error: "חסר videoId או action" }, { status: 400 });
  }

  if (!["approve", "reject", "revision", "restore"].includes(action)) {
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

  const v = video as any;
  const now = new Date().toISOString();

  // --- Portfolio video: take down / restore (MOD-01) -------------------------------------------
  if (!v.connection_id) {
    if (action === "reject") {
      const notes = typeof revision_notes === "string" && revision_notes.trim() ? revision_notes.trim() : "הסרטון הוסר על ידי צוות המודרציה";
      await supabase
        .from("videos")
        .update({ status: "rejected", revision_notes: notes } as any)
        .eq("id", videoId);
      if (v.creator_id) {
        await createNotification({
          userId: v.creator_id,
          type: "portfolio_video_removed",
          title: "סרטון הוסר מתיק העבודות",
          body: `${notes}. הסרטון לא נספר יותר ב-5 הסרטונים ואינו מוצג לעסקים.`,
          data: { videoId },
        });
      }
      await logActivity({ actorId: adminId || undefined, action: "portfolio_video_rejected", entityType: "video", entityId: videoId, details: { notes } });
      return NextResponse.json({ success: true, action, status: "rejected" });
    }
    if (action === "restore" || action === "approve") {
      await supabase
        .from("videos")
        .update({ status: "approved", approved_at: now, approved_by: adminId, revision_notes: null } as any)
        .eq("id", videoId);
      await logActivity({ actorId: adminId || undefined, action: "portfolio_video_restored", entityType: "video", entityId: videoId });
      return NextResponse.json({ success: true, action, status: "approved" });
    }
    return NextResponse.json({ error: "פעולה לא רלוונטית לסרטון תיק עבודות" }, { status: 400 });
  }

  // --- Deliverable of a connection --------------------------------------------------------------
  const conn = v.connections;
  const creatorUser = conn?.creator_profiles?.users;
  const brandUser = conn?.brand_profiles?.users;

  if (action === "approve") {
    await supabase
      .from("videos")
      .update({ status: "approved", approved_at: now, approved_by: adminId } as any)
      .eq("id", videoId);

    // Move connection to in_review (brand review); the brand may also complete it straight from uploaded
    if (conn?.status === "uploaded") {
      await supabase
        .from("connections")
        .update({ status: "in_review", review_deadline: new Date(Date.now() + 7 * 86400000).toISOString() } as any)
        .eq("id", conn.id);

      if (brandUser) {
        await createNotification({
          userId: brandUser.id,
          type: "video_ready_for_review",
          title: "סרטון מוכן לסקירה",
          body: `סרטון חדש עבור "${conn.products?.name}" מוכן לצפייה ואישור.`,
          data: { connectionId: conn.id },
        });
      }
    }

    await logActivity({ actorId: adminId || undefined, action: "video_approved", entityType: "video", entityId: videoId });
  } else if (action === "revision") {
    if (!revision_notes) {
      return NextResponse.json({ error: "חובה לציין מה לתקן" }, { status: 400 });
    }

    await supabase
      .from("videos")
      .update({ status: "revision_requested", revision_notes } as any)
      .eq("id", videoId);

    if (conn) {
      await supabase
        .from("connections")
        .update({ status: "revision_requested", revision_notes, revision_count: (conn.revision_count || 0) + 1 } as any)
        .eq("id", conn.id);

      if (creatorUser) {
        await createNotification({
          userId: creatorUser.id,
          type: "revision_requested",
          title: "נדרש תיקון בסרטון",
          body: `אדמין ביקש תיקון: ${revision_notes}`,
          data: { connectionId: conn.id },
        });
      }
    }

    await logActivity({ actorId: adminId || undefined, action: "video_revision_requested", entityType: "video", entityId: videoId, details: { revision_notes } });
  } else if (action === "reject") {
    await supabase
      .from("videos")
      .update({ status: "revision_requested", revision_notes: revision_notes || "הסרטון נדחה" } as any)
      .eq("id", videoId);

    await logActivity({ actorId: adminId || undefined, action: "video_rejected", entityType: "video", entityId: videoId });
  } else {
    return NextResponse.json({ error: "פעולה לא רלוונטית לסרטון חיבור" }, { status: 400 });
  }

  return NextResponse.json({ success: true, action });
}
