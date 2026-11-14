import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { isMatched } from "@/lib/admin-creators";

type Ctx = { params: Promise<{ id: string }> };

// One creator for the admin (owner list, 2026-11-14): the account, the profile, and every video split into
// portfolio vs. collaboration work, each with a short-lived signed URL so an admin can watch it.
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data: u } = await supabase
    .from("users")
    .select(`
      id, full_name, phone, is_active, is_admin, avatar_url, created_at, last_seen_at, type,
      creator_profiles(id, level, categories, tiktok_handle, instagram_handle, tiktok_followers, instagram_followers, city, bio)
    `)
    .eq("id", id)
    .maybeSingle();
  if (!u) return NextResponse.json({ error: "יוצר/ת לא נמצא/ה" }, { status: 404 });

  const user = u as any;
  const profile = Array.isArray(user.creator_profiles) ? user.creator_profiles[0] : user.creator_profiles;

  const [{ data: videos, error: vErr }, connsRes] = await Promise.all([
    supabase
      .from("videos")
      .select(`
        id, title, status, thumbnail_url, storage_path, url, created_at, connection_id, revision_notes,
        connections(id, status, products(name), brand_profiles!connections_brand_id_fkey(shop_name))
      `)
      .eq("creator_id", id)
      .order("created_at", { ascending: false }),
    profile?.id ? supabase.from("connections").select("initiated_by, status").eq("creator_id", profile.id) : Promise.resolve({ data: [] as any[] }),
  ]);
  if (vErr) {
    console.error("[admin/creators/:id] videos:", vErr.message);
    return NextResponse.json({ error: "שגיאה בטעינת הסרטונים" }, { status: 500 });
  }

  // Signed playback URLs (1 hour) for files in the private videos bucket
  const rows = (videos || []) as any[];
  const paths = rows.map((v) => v.storage_path).filter((p): p is string => typeof p === "string" && p.length > 0);
  const signedByPath: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("videos").createSignedUrls(paths, 3600);
    for (const s of signed || []) if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
  }
  const mapVideo = (v: any) => ({
    id: v.id,
    title: v.title || null,
    status: v.status || null,
    thumbnail_url: v.thumbnail_url || null,
    created_at: v.created_at,
    connection_id: v.connection_id || null,
    revision_notes: v.revision_notes || null,
    play_url: (v.storage_path && signedByPath[v.storage_path]) || v.url || null,
    product: v.connections?.products?.name || null,
    brand: v.connections?.brand_profiles?.shop_name || null,
    connection_status: v.connections?.status || null,
  });

  const conns = (connsRes.data || []) as { initiated_by: string | null; status: string | null }[];
  return NextResponse.json({
    creator: {
      id: user.id,
      name: user.full_name || "",
      phone: user.phone || "",
      type: user.type,
      is_active: user.is_active !== false,
      is_admin: user.is_admin === true,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at || null,
      level: profile?.level || "creator",
      categories: Array.isArray(profile?.categories) ? profile.categories : [],
      city: profile?.city || null,
      bio: profile?.bio || null,
      tiktok_handle: profile?.tiktok_handle || null,
      instagram_handle: profile?.instagram_handle || null,
      tiktok_followers: Number(profile?.tiktok_followers) || 0,
      instagram_followers: Number(profile?.instagram_followers) || 0,
      hearts_from_brands: conns.filter((c) => c.initiated_by === "brand").length,
      matches: conns.filter((c) => isMatched(c.status)).length,
    },
    portfolio: rows.filter((v) => !v.connection_id).map(mapVideo),
    collab: rows.filter((v) => !!v.connection_id).map(mapVideo),
  });
}

// Take a video down / put it back (content control). Touches only the video row — never the connection
// flow — so a collaboration video can be removed without re-running the review state machine.
//   remove  → status "rejected" + a note (hidden from the gallery / the chat; the creator is told)
//   restore → portfolio: "approved"; collaboration: "pending" (back to the business's review)
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { videoId?: unknown; action?: unknown; note?: unknown };
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const action = body.action === "remove" || body.action === "restore" ? body.action : null;
  if (!videoId || !action) return NextResponse.json({ error: "חסר videoId או action" }, { status: 400 });

  const { data: video } = await supabase.from("videos").select("id, creator_id, connection_id, status").eq("id", videoId).maybeSingle();
  if (!video || (video as any).creator_id !== id) return NextResponse.json({ error: "סרטון לא נמצא" }, { status: 404 });
  const v = video as any;

  if (action === "remove") {
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : "הסרטון הוסר על ידי צוות משפיען אונליין";
    const { error } = await supabase.from("videos").update({ status: "rejected", revision_notes: note } as any).eq("id", videoId);
    if (error) return NextResponse.json({ error: "שגיאה בהסרה" }, { status: 500 });
    await createNotification({
      userId: id,
      type: v.connection_id ? "video_removed" : "portfolio_video_removed",
      title: v.connection_id ? "סרטון הוסר מהחיבור" : "סרטון הוסר מתיק העבודות",
      body: `${note}. לבירור אפשר לפנות אלינו דרך "צור קשר".`,
      data: { videoId, role: "creator" },
    });
    await logActivity({ actorId: adminId || undefined, action: "admin_video_removed", entityType: "video", entityId: videoId, details: { creatorId: id, note, collaboration: !!v.connection_id } });
    return NextResponse.json({ success: true, status: "rejected" });
  }

  const restored = v.connection_id ? "pending" : "approved";
  const { error } = await supabase
    .from("videos")
    .update({ status: restored, revision_notes: null, ...(v.connection_id ? {} : { approved_at: new Date().toISOString(), approved_by: adminId }) } as any)
    .eq("id", videoId);
  if (error) return NextResponse.json({ error: "שגיאה בשחזור" }, { status: 500 });
  await logActivity({ actorId: adminId || undefined, action: "admin_video_restored", entityType: "video", entityId: videoId, details: { creatorId: id, status: restored } });
  return NextResponse.json({ success: true, status: restored });
}
