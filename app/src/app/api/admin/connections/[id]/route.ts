import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity, notificationData } from "@/lib/notifications";
import { detectContactInfo } from "@/lib/moderation/chat-filter";
import { contactWarnings, messageSide } from "@/lib/admin-connections";
import { CHAT_BLOCKED_TEXT, CHAT_UNBLOCKED_TEXT, isChatBlocked } from "@/lib/chat-block";

type Ctx = { params: Promise<{ id: string }> };

// One connection for the admin (owner list 2026-11-14, item 5): both sides, the product and its brief, the
// transcript with each message's side and contact-sharing warnings, the deliverables with signed playback
// links, and the chat block state.
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data: raw, error } = await supabase
    .from("connections")
    .select(`
      id, status, initiated_by, mutual_at, created_at, approved_at, shipped_at, delivered_at, completed_at,
      brief_posted_at, brief_approved_at, revision_count, revision_notes, tracking_number, tracking_url,
      delivery_proof_url, delivery_type, product_id, blocked_at, blocked_reason, blocked_by,
      products(id, name, image_url, product_type, brief, brief_data),
      creator_profiles!connections_creator_id_fkey(id, user_id, users(id, full_name, phone, avatar_url)),
      brand_profiles!connections_brand_id_fkey(id, user_id, shop_name, logo_url, users(id, full_name, phone))
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[admin/connections/:id] load:", error.message);
    return NextResponse.json({ error: "שגיאה בטעינת החיבור" }, { status: 500 });
  }
  if (!raw) return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });

  const c = raw as any;
  const creatorUser = c.creator_profiles?.users;
  const brandUser = c.brand_profiles?.users;
  const creatorUserId: string | null = creatorUser?.id || c.creator_profiles?.user_id || null;
  const brandUserId: string | null = brandUser?.id || c.brand_profiles?.user_id || null;

  const [msgRes, vidRes, blockerRes] = await Promise.all([
    supabase.from("messages").select("id, sender_id, text, is_system, kind, data, created_at").eq("connection_id", id).order("created_at", { ascending: true }),
    supabase.from("videos").select("id, status, thumbnail_url, storage_path, url, created_at, revision_notes").eq("connection_id", id).order("created_at", { ascending: true }),
    c.blocked_by ? supabase.from("users").select("full_name").eq("id", c.blocked_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Signed playback URLs (1 hour) from the private deliverables bucket (migration 025)
  const videoRows = (vidRes.data || []) as any[];
  const paths = videoRows.map((v) => v.storage_path).filter((p): p is string => typeof p === "string" && p.length > 0);
  const signedByPath: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("deliverables").createSignedUrls(paths, 3600);
    for (const s of signed || []) if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
  }
  const videos = videoRows.map((v) => ({
    id: v.id as string,
    status: (v.status as string) || null,
    thumbnail_url: (v.thumbnail_url as string) || null,
    created_at: v.created_at as string,
    revision_notes: (v.revision_notes as string) || null,
    play_url: (v.storage_path && signedByPath[v.storage_path]) || (v.url as string) || null,
  }));
  const videoById = new Map(videos.map((v) => [v.id, v]));

  // The transcript: side, and why a line deserves a second look (only what the two parties wrote)
  const messages = ((msgRes.data || []) as any[]).map((m) => {
    const side = messageSide(m, creatorUserId, brandUserId);
    const warnings = side === "creator" || side === "brand" ? contactWarnings(m.text, detectContactInfo) : [];
    let data = m.data || null;
    if (m.kind === "video" && data?.video_id) {
      const v = videoById.get(data.video_id as string);
      data = { ...data, url: v?.play_url || null, thumbnail_url: v?.thumbnail_url || null, status: v?.status || null };
    }
    return {
      id: m.id as string,
      sender_id: (m.sender_id as string) || null,
      text: (m.text as string) || "",
      is_system: !!m.is_system,
      kind: (m.kind as string) || "text",
      data,
      created_at: m.created_at as string,
      side,
      warnings,
    };
  });

  return NextResponse.json({
    connection: {
      id: c.id,
      status: c.status || null,
      initiated_by: c.initiated_by || null,
      mutual_at: c.mutual_at || null,
      created_at: c.created_at,
      approved_at: c.approved_at || null,
      shipped_at: c.shipped_at || null,
      delivered_at: c.delivered_at || null,
      completed_at: c.completed_at || null,
      brief_posted_at: c.brief_posted_at || null,
      brief_approved_at: c.brief_approved_at || null,
      revision_count: c.revision_count || 0,
      revision_notes: c.revision_notes || null,
      tracking_number: c.tracking_number || null,
      tracking_url: c.tracking_url || null,
      delivery_proof_url: c.delivery_proof_url || null,
      delivery_type: c.delivery_type || null,
      blocked_at: c.blocked_at || null,
      blocked_reason: c.blocked_reason || null,
      blocked_by_name: ((blockerRes as any)?.data?.full_name as string) || null,
      product: c.products
        ? {
            id: c.products.id,
            name: c.products.name || "",
            image_url: c.products.image_url || null,
            product_type: c.products.product_type || null,
            brief: c.products.brief || null,
            brief_data: c.products.brief_data || null,
          }
        : null,
      creator: {
        user_id: creatorUserId,
        profile_id: c.creator_profiles?.id || null,
        name: (creatorUser?.full_name || "").trim() || (creatorUser?.phone ? `ללא שם (${creatorUser.phone})` : "יוצר/ת"),
        phone: creatorUser?.phone || null,
        avatar_url: creatorUser?.avatar_url || null,
      },
      brand: {
        user_id: brandUserId,
        profile_id: c.brand_profiles?.id || null,
        name: c.brand_profiles?.shop_name || brandUser?.full_name || "עסק",
        contact_name: brandUser?.full_name || null,
        phone: brandUser?.phone || null,
        logo_url: c.brand_profiles?.logo_url || null,
      },
    },
    messages,
    videos,
    warnings_total: messages.filter((m) => m.warnings.length > 0).length,
  });
}

// PUT { action: "block" | "unblock", reason? } — stop or release the chat. While stopped the parties' routes
// refuse messages, briefs, deliverables and status moves (lib/chat-block.ts); both sides see the stop in the
// chat and get a notification that opens it. The reason stays internal.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase || !adminId) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action === "block" ? "block" : body?.action === "unblock" ? "unblock" : null;
  if (!action) return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  const { data: raw } = await supabase
    .from("connections")
    .select(`
      id, product_id, blocked_at, products(name),
      creator_profiles!connections_creator_id_fkey(user_id),
      brand_profiles!connections_brand_id_fkey(user_id)
    `)
    .eq("id", id)
    .maybeSingle();
  if (!raw) return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  const c = raw as any;
  const blocked = isChatBlocked(c);
  if (action === "block" && blocked) return NextResponse.json({ error: "הצ'אט כבר חסום" }, { status: 400 });
  if (action === "unblock" && !blocked) return NextResponse.json({ error: "הצ'אט לא חסום" }, { status: 400 });

  const now = new Date().toISOString();
  const updates =
    action === "block"
      ? { blocked_at: now, blocked_reason: reason || null, blocked_by: adminId }
      : { blocked_at: null, blocked_reason: null, blocked_by: null };
  const { error } = await supabase.from("connections").update(updates as any).eq("id", id);
  if (error) {
    console.error("[admin/connections/:id] block:", error.message);
    return NextResponse.json({ error: "שגיאה בעדכון החיבור" }, { status: 500 });
  }

  // The marker both sides see in the chat (a system row carrying the admin's id), then the notifications
  const text = action === "block" ? CHAT_BLOCKED_TEXT : CHAT_UNBLOCKED_TEXT;
  await supabase.from("messages").insert({
    connection_id: id,
    sender_id: adminId,
    text,
    is_system: true,
    kind: "event",
    data: { event: action === "block" ? "chat_blocked" : "chat_unblocked" },
  } as any);

  const productName: string = c.products?.name || "";
  const targets: { userId: string; role: "creator" | "brand" }[] = [];
  if (c.creator_profiles?.user_id) targets.push({ userId: c.creator_profiles.user_id, role: "creator" });
  if (c.brand_profiles?.user_id) targets.push({ userId: c.brand_profiles.user_id, role: "brand" });
  await Promise.all(
    targets.map((t) =>
      createNotification({
        userId: t.userId,
        type: action === "block" ? "chat_blocked" : "chat_unblocked",
        title: action === "block" ? "⛔ ההתקשרות נעצרה" : "🔓 ההתקשרות שוחררה",
        body: `${text}${productName ? ` · "${productName}"` : ""}`,
        data: notificationData(id, c.product_id || null, t.role),
      })
    )
  );
  await logActivity({
    actorId: adminId,
    action: action === "block" ? "admin_block_chat" : "admin_unblock_chat",
    entityType: "connection",
    entityId: id,
    details: { reason: reason || null },
  });

  return NextResponse.json({
    success: true,
    blocked_at: action === "block" ? now : null,
    blocked_reason: action === "block" ? reason || null : null,
  });
}
