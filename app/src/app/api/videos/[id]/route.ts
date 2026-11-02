import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { thumbnailPathFromUrl } from "@/lib/authz";
import { countPortfolioVideos } from "@/lib/match";

type RouteContext = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET /api/videos/[id] — get a signed viewing URL for a video
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Get user info
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 403 });
  }

  // Get video with connection info
  const { data: video } = await supabase
    .from("videos")
    .select(`
      *,
      connections(creator_id, brand_id, status)
    `)
    .eq("id", id)
    .single();

  if (!video) {
    return NextResponse.json({ error: "סרטון לא נמצא" }, { status: 404 });
  }

  const conn = (video as any).connections;
  const isAdmin = (dbUser as any).type === "admin";
  const isCreator = conn?.creator_id === (dbUser as any).id;
  const isBrand = conn?.brand_id === (dbUser as any).id;

  // Check brand_profiles user_id match too
  let isBrandUser = false;
  if (!isBrand && !isCreator && !isAdmin) {
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("user_id", (dbUser as any).id)
      .eq("id", conn?.brand_id)
      .single();
    isBrandUser = !!brandProfile;

    if (!isBrandUser) {
      const { data: creatorProfile } = await supabase
        .from("creator_profiles")
        .select("id")
        .eq("user_id", (dbUser as any).id)
        .eq("id", conn?.creator_id)
        .single();
      if (!creatorProfile) {
        return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
      }
    }
  }

  // Generate signed URL for viewing (1 hour TTL)
  const storagePath = (video as any).storage_path || extractStoragePath((video as any).url);

  let signedUrl: string | null = null;
  if (storagePath) {
    const { data } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 86400);
    signedUrl = data?.signedUrl || null;
  }

  // Determine if download is allowed
  const canDownload = (video as any).is_downloadable && (
    isAdmin || isBrand || isBrandUser
  );

  let downloadUrl: string | null = null;
  if (canDownload && storagePath) {
    const { data } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 3600, { download: true });
    downloadUrl = data?.signedUrl || null;

    // Increment download counter
    await supabase
      .from("videos")
      .update({ download_count: ((video as any).download_count || 0) + 1 } as any)
      .eq("id", id);
  }

  return NextResponse.json({
    video: {
      id: (video as any).id,
      status: (video as any).status,
      duration_seconds: (video as any).duration_seconds,
      created_at: (video as any).created_at,
      is_downloadable: (video as any).is_downloadable,
      download_count: (video as any).download_count,
    },
    viewUrl: signedUrl || (video as any).url,
    downloadUrl,
    canDownload,
  });
}

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  // URLs look like: https://<project>.supabase.co/storage/v1/object/public/videos/<path>
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/videos\/(.+)/);
  return match ? match[1] : null;
}

// DELETE /api/videos/[id] — a creator removes one of their own portfolio videos (admins may remove any video).
// Deliverables attached to a connection are part of a brand's order and are not deletable here (VID-01).
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();
  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 403 });
  }

  const { data: video } = await supabase
    .from("videos")
    .select("id, creator_id, connection_id, storage_path, thumbnail_url")
    .eq("id", id)
    .single();
  if (!video) {
    return NextResponse.json({ error: "סרטון לא נמצא" }, { status: 404 });
  }

  const v = video as any;
  const isAdmin = (dbUser as any).type === "admin";
  const ownsPortfolioVideo = v.creator_id === (dbUser as any).id && v.connection_id === null;
  if (!isAdmin && !ownsPortfolioVideo) {
    return NextResponse.json({ error: "ניתן למחוק רק סרטוני פורטפוליו שלך" }, { status: 403 });
  }

  // Storage objects first (best effort), then the row
  if (v.storage_path) {
    const { error: rmError } = await supabase.storage.from("videos").remove([v.storage_path]);
    if (rmError) console.error("[videos] storage remove error:", rmError.message);
  }
  const thumbPath = thumbnailPathFromUrl(v.thumbnail_url);
  if (thumbPath) {
    const { error: rmThumbError } = await supabase.storage.from("thumbnails").remove([thumbPath]);
    if (rmThumbError) console.error("[videos] thumbnail remove error:", rmThumbError.message);
  }

  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) {
    console.error("[videos] delete error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הסרטון" }, { status: 500 });
  }

  const portfolioCount = ownsPortfolioVideo ? await countPortfolioVideos(supabase, (dbUser as any).id) : undefined;
  return NextResponse.json({ success: true, portfolio_count: portfolioCount });
}
