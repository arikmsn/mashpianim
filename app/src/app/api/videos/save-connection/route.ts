import { NextResponse, type NextRequest } from "next/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isOwnConnectionVideoPath, isImagePath, canUploadConnectionVideo } from "@/lib/authz";
import { notifyConnectionStatusChange, logActivity } from "@/lib/notifications";
import { getTimelineSettings } from "@/lib/settings";
import { FINAL_REVIEW_HOURS } from "@/lib/chat";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST /api/videos/save-connection
// Records a deliverable the creator uploaded straight to Storage (portfolio/<uid>/connections/<connectionId>/...)
// and moves the connection to "uploaded". Pairs with the browser-side upload in the connections page (FUNC-01).
export async function POST(request: NextRequest) {
  try {
    const { connectionId, storagePath, thumbnailPath } = await request.json();

    if (!connectionId || typeof connectionId !== "string" || !storagePath) {
      return NextResponse.json({ error: "חסר מזהה חיבור או נתיב קובץ" }, { status: 400 });
    }

    const userClient = await createServerClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    if (!isOwnConnectionVideoPath(storagePath, user.id, connectionId)) {
      return NextResponse.json({ error: "נתיב קובץ לא תקין" }, { status: 400 });
    }
    const hasThumb = isOwnConnectionVideoPath(thumbnailPath, user.id, connectionId) && isImagePath(thumbnailPath);
    const thumbnailUrl = hasThumb
      ? `${process.env.NEXT_SUPABASE_URL}/storage/v1/object/public/thumbnails/${thumbnailPath}`
      : null;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("id, type")
      .eq("auth_user_id", user.id)
      .single();
    const sessionRole = (await resolveViewer(supabase, user.id, await readActiveRole()))?.role;
    if (!dbUser || sessionRole !== "creator") {
      return NextResponse.json({ error: "רק יוצרים יכולים להעלות סרטונים לחיבור" }, { status: 403 });
    }

    const { data: connection } = await supabase
      .from("connections")
      .select(`
        id, status, filmed_at, product_id, revision_count,
        products(name),
        creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name)),
        brand_profiles!connections_brand_id_fkey(user_id, shop_name, users(id, full_name))
      `)
      .eq("id", connectionId)
      .single();

    const conn = connection as any;
    if (!conn) {
      return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
    }
    if (conn.creator_profiles?.user_id !== (dbUser as any).id) {
      return NextResponse.json({ error: "אין הרשאה להעלות סרטון לחיבור זה" }, { status: 403 });
    }
    if (!canUploadConnectionVideo(conn.status)) {
      return NextResponse.json({ error: "לא ניתן להעלות סרטון בסטטוס הנוכחי של החיבור" }, { status: 400 });
    }

    // Signing also proves the object exists
    const { data: signedData, error: signError } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 86400);
    if (signError || !signedData?.signedUrl) {
      return NextResponse.json({ error: "הקובץ לא נמצא באחסון" }, { status: 400 });
    }

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        connection_id: connectionId,
        creator_id: (dbUser as any).id,
        url: signedData.signedUrl,
        storage_path: storagePath,
        thumbnail_url: thumbnailUrl,
        duration_seconds: null,
        status: "pending",
        revision_notes: null,
        moderation_flags: [],
        ai_review_result: null,
        is_downloadable: false,
        download_count: 0,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("[videos] connection insert error:", insertError);
      await supabase.storage.from("videos").remove([storagePath]);
      if (hasThumb) await supabase.storage.from("thumbnails").remove([thumbnailPath]);
      return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
    }

    // The brand's review clock starts now: review_days for the first upload (auto-approve after the grace
    // period, see cron); the revised upload is final and closes after 24 h without an answer
    const timelines = await getTimelineSettings(supabase);
    const nowMs = Date.now();
    const round = (conn.revision_count || 0) + 1;
    const finalRound = (conn.revision_count || 0) >= timelines.max_revisions;
    const reviewDeadline = finalRound
      ? new Date(nowMs + FINAL_REVIEW_HOURS * 3600000).toISOString()
      : new Date(nowMs + timelines.review_days * 86400000).toISOString();
    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: "uploaded",
        filmed_at: conn.filmed_at || new Date(nowMs).toISOString(),
        review_deadline: reviewDeadline,
      } as any)
      .eq("id", connectionId);
    if (updateError) {
      console.error("[videos] connection status error:", updateError);
    }

    // The deliverable shows in the chat as a card (fresh URLs are attached when the chat loads)
    await supabase.from("messages").insert({
      connection_id: connectionId,
      sender_id: (dbUser as any).id,
      text: round > 1 ? "🎬 הגרסה המתוקנת הועלתה" : "🎬 הסרטון הועלה",
      is_system: false,
      kind: "video",
      data: { video_id: (video as any)?.id, round, final: finalRound },
    } as any);

    const creatorUser = conn.creator_profiles?.users;
    const brandUser = conn.brand_profiles?.users;
    if (creatorUser && brandUser) {
      await notifyConnectionStatusChange("uploaded", {
        connectionId,
        productName: conn.products?.name || "",
        creatorName: creatorUser.full_name || "יוצר",
        brandName: conn.brand_profiles?.shop_name || brandUser.full_name || "עסק",
        creatorUserId: creatorUser.id,
        brandUserId: brandUser.id,
        productId: conn.product_id,
      });
    }
    await logActivity({
      actorId: (dbUser as any).id,
      action: "connection_uploaded",
      entityType: "connection",
      entityId: connectionId,
      details: { from: conn.status, to: "uploaded", video_id: (video as any)?.id },
    });

    return NextResponse.json({ success: true, video, status: "uploaded" });
  } catch (err) {
    console.error("[videos] save-connection error:", err);
    return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
  }
}
