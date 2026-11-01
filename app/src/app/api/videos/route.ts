import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/admin-auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      videos: [
        {
          id: "mock-video-1",
          connection_id: connectionId,
          url: "/mock-video.mp4",
          thumbnail_url: null,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ videos: [] });
  }

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: data || [] });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const connectionId = formData.get("connectionId") as string | null;

    if (!file || !connectionId) {
      return NextResponse.json(
        { error: "חסר קובץ וידאו או מזהה חיבור" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        video: {
          id: `mock-${Date.now()}`,
          connection_id: connectionId,
          url: `/uploads/mock-${Date.now()}.mp4`,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
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
      return NextResponse.json(
        { error: "שגיאה בהעלאת הקובץ" },
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("videos")
      .getPublicUrl(fileName);

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        connection_id: connectionId,
        url: publicUrl.publicUrl,
        thumbnail_url: null,
        duration_seconds: null,
        status: "pending",
        revision_notes: null,
        moderation_flags: [],
        ai_review_result: null,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("[videos] insert error:", insertError);
      return NextResponse.json(
        { error: "שגיאה בשמירת הסרטון" },
        { status: 500 }
      );
    }

    // Update connection status to "uploaded"
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
