import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { storagePath, title } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: "חסר נתיב קובץ" }, { status: 400 });
    }

    const userClient = await createServerClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("id, type")
      .eq("auth_user_id", user.id)
      .single();

    if (!dbUser || (dbUser as any).type !== "creator") {
      return NextResponse.json({ error: "רק יוצרים יכולים להעלות סרטוני פורטפוליו" }, { status: 403 });
    }

    const { data: signedData } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 86400);

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        creator_id: (dbUser as any).id,
        connection_id: null,
        url: signedData?.signedUrl || "",
        storage_path: storagePath,
        title: title || null,
        description: null,
        thumbnail_url: null,
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
      return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
    }

    return NextResponse.json({ success: true, video });
  } catch (err) {
    console.error("[videos] save-portfolio error:", err);
    return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
  }
}
