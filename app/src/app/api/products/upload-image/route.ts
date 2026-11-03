import { NextResponse, type NextRequest } from "next/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, detectImageType, extensionForImage } from "@/lib/uploads";

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

    // Brands only — judged by the role this session is signed in as
    const viewer = await resolveViewer(supabase, user.id, await readActiveRole());
    if (!viewer || viewer.role !== "brand") {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
    const dbUser = { id: viewer.userId, type: viewer.role };

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "חסר קובץ תמונה" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `הקובץ גדול מדי (מקסימום ${MAX_IMAGE_MB}MB)` }, { status: 400 });
    }

    // The file's own bytes decide the type and extension — not the name or the client's content-type (SEC-10)
    const arrayBuffer = await file.arrayBuffer();
    const mime = detectImageType(new Uint8Array(arrayBuffer.slice(0, 16)));
    if (!mime) {
      return NextResponse.json({ error: "הקובץ אינו תמונה תקינה (JPG, PNG או WebP)" }, { status: 400 });
    }
    const fileName = `products/${(dbUser as any).id}/${Date.now()}.${extensionForImage(mime)}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, arrayBuffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-image] error:", uploadError);
      return NextResponse.json({ error: "שגיאה בהעלאת התמונה" }, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("images")
      .createSignedUrl(fileName, 86400 * 365);

    return NextResponse.json({
      success: true,
      url: signedData?.signedUrl || "",
      storagePath: fileName,
    });
  } catch (err) {
    console.error("[upload-image] error:", err);
    return NextResponse.json({ error: "שגיאה בהעלאת התמונה" }, { status: 500 });
  }
}
