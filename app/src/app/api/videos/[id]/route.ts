import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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
