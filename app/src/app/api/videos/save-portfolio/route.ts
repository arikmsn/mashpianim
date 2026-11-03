import { NextResponse, type NextRequest } from "next/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isOwnPortfolioPath, isImagePath } from "@/lib/authz";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { storagePath, title, thumbnailPath } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: "חסר נתיב קובץ" }, { status: 400 });
    }

    const userClient = await createServerClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    // Both files must live directly under this user's own portfolio folder (portfolio/<uid>/<file>)
    if (!isOwnPortfolioPath(storagePath, user.id)) {
      return NextResponse.json({ error: "נתיב קובץ לא תקין" }, { status: 400 });
    }
    const hasThumb = isOwnPortfolioPath(thumbnailPath, user.id) && isImagePath(thumbnailPath);
    const thumbnailUrl = hasThumb
      ? `${process.env.NEXT_SUPABASE_URL}/storage/v1/object/public/thumbnails/${thumbnailPath}`
      : null;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    // The role this session is signed in as decides (an admin signed in as a creator uploads like one)
    const viewer = await resolveViewer(supabase, user.id, await readActiveRole());
    const dbUser = viewer ? { id: viewer.userId, type: viewer.role } : null;

    if (!dbUser || dbUser.type !== "creator") {
      return NextResponse.json({ error: "רק יוצרים יכולים להעלות סרטוני פורטפוליו" }, { status: 403 });
    }

    // Signing also proves the object exists; a missing file is a client error, not a row to keep
    const { data: signedData, error: signError } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 86400);
    if (signError || !signedData?.signedUrl) {
      return NextResponse.json({ error: "הקובץ לא נמצא באחסון" }, { status: 400 });
    }

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        creator_id: (dbUser as any).id,
        connection_id: null,
        url: signedData?.signedUrl || "",
        storage_path: storagePath,
        title: title || null,
        description: null,
        thumbnail_url: thumbnailUrl,
        duration_seconds: null,
        status: "approved",
        approved_at: new Date().toISOString(),
        revision_notes: null,
        moderation_flags: [],
        ai_review_result: null,
        is_downloadable: false,
        download_count: 0,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("[videos] portfolio insert error:", insertError);
      // Don't leave an orphan object behind when the metadata row could not be written
      await supabase.storage.from("videos").remove([storagePath]);
      if (hasThumb) await supabase.storage.from("thumbnails").remove([thumbnailPath]);
      return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
    }

    return NextResponse.json({ success: true, video });
  } catch (err) {
    console.error("[videos] save-portfolio error:", err);
    return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
  }
}
