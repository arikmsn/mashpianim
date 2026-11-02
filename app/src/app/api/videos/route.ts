import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  const creatorPortfolio = request.nextUrl.searchParams.get("portfolio");

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

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 403 });
  }

  if (creatorPortfolio === "me") {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("creator_id", (dbUser as any).id)
      .is("connection_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const videos = await refreshVideoUrls(supabase, data || []);
    return NextResponse.json({ videos });
  }

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId or portfolio required" }, { status: 400 });
  }

  if ((dbUser as any).type !== "admin") {
    const { data: connection } = await supabase
      .from("connections")
      .select("creator_id, brand_id")
      .eq("id", connectionId)
      .single();

    if (!connection ||
        ((dbUser as any).id !== (connection as any).creator_id &&
         (dbUser as any).id !== (connection as any).brand_id)) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const videos = await refreshVideoUrls(supabase, data || []);
  return NextResponse.json({ videos });
}

async function refreshVideoUrls(supabase: any, videos: any[]) {
  return Promise.all(
    videos.map(async (video: any) => {
      if (!video.storage_path) return video;
      const { data } = await supabase.storage
        .from("videos")
        .createSignedUrl(video.storage_path, 86400);
      return { ...video, url: data?.signedUrl || video.url };
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const connectionId = formData.get("connectionId") as string | null;
    const isPortfolio = formData.get("portfolio") as string | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json({ error: "חסר קובץ וידאו" }, { status: 400 });
    }

    if (!connectionId && isPortfolio !== "true") {
      return NextResponse.json(
        { error: "חסר מזהה חיבור או סימון פורטפוליו" },
        { status: 400 }
      );
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

    if (!dbUser) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 403 });
    }

    if (isPortfolio === "true") {
      if ((dbUser as any).type !== "creator") {
        return NextResponse.json({ error: "רק יוצרים יכולים להעלות סרטוני פורטפוליו" }, { status: 403 });
      }

      const ext = file.name.split(".").pop() || "mp4";
      const fileName = `portfolio/${(dbUser as any).id}/${Date.now()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, arrayBuffer, {
          contentType: file.type || "video/mp4",
          upsert: false,
        });

      if (uploadError) {
        console.error("[videos] portfolio upload error:", uploadError);
        return NextResponse.json({ error: "שגיאה בהעלאת הקובץ" }, { status: 500 });
      }

      const { data: signedData } = await supabase.storage
        .from("videos")
        .createSignedUrl(fileName, 86400);

      const { data: video, error: insertError } = await supabase
        .from("videos")
        .insert({
          creator_id: (dbUser as any).id,
          connection_id: null,
          url: signedData?.signedUrl || "",
          storage_path: fileName,
          title: title || null,
          description: description || null,
          thumbnail_url: null,
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
        console.error("[videos] portfolio insert error:", insertError);
        return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
      }

      return NextResponse.json({ success: true, video });
    }

    // Connection-based upload (existing flow)
    const { data: connection } = await supabase
      .from("connections")
      .select("creator_id")
      .eq("id", connectionId)
      .single();

    if (!connection || (dbUser as any).id !== (connection as any).creator_id) {
      return NextResponse.json({ error: "אין הרשאה להעלות סרטון לחיבור זה" }, { status: 403 });
    }

    const ext = file.name.split(".").pop() || "mp4";
    const fileName = `${connectionId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, arrayBuffer, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      console.error("[videos] upload error:", uploadError);
      return NextResponse.json({ error: "שגיאה בהעלאת הקובץ" }, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("videos")
      .createSignedUrl(fileName, 86400);

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        connection_id: connectionId,
        creator_id: (dbUser as any).id,
        url: signedData?.signedUrl || "",
        storage_path: fileName,
        thumbnail_url: null,
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
      console.error("[videos] insert error:", insertError);
      return NextResponse.json({ error: "שגיאה בשמירת הסרטון" }, { status: 500 });
    }

    await supabase
      .from("connections")
      .update({ status: "uploaded" } as any)
      .eq("id", connectionId);

    return NextResponse.json({ success: true, video });
  } catch (err) {
    console.error("[videos] error:", err);
    return NextResponse.json({ error: "שגיאה בהעלאת הסרטון" }, { status: 500 });
  }
}
