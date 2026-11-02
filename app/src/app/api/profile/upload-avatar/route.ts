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
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "חסר קובץ תמונה" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 5MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatars/${(dbUser as any).id}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, arrayBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-avatar] error:", uploadError);
      return NextResponse.json({ error: "שגיאה בהעלאת התמונה" }, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("images")
      .createSignedUrl(fileName, 86400 * 365);

    const avatarUrl = signedData?.signedUrl || "";

    await (supabase.from("users") as any)
      .update({ avatar_url: avatarUrl })
      .eq("id", (dbUser as any).id);

    return NextResponse.json({ success: true, url: avatarUrl });
  } catch (err) {
    console.error("[upload-avatar] error:", err);
    return NextResponse.json({ error: "שגיאה בהעלאת התמונה" }, { status: 500 });
  }
}
