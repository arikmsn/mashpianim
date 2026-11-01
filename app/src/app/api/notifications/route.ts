import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

const mockNotifications = [
  {
    id: "1",
    type: "connection_approved",
    title: "בקשת חיבור אושרה!",
    body: "GlowUp Skincare אישרו את הבקשה שלך לסרום ויטמין C",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    type: "new_message",
    title: "הודעה חדשה",
    body: "קיבלתם הודעה חדשה מ-TechFit",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "3",
    type: "video_approved",
    title: "הסרטון אושר!",
    body: "הסרטון שלכם עבור שעון ספורט חכם אושר בהצלחה",
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "4",
    type: "system",
    title: "ברוכים הבאים!",
    body: "ברוכים הבאים ל-Mashpianim! התחילו לגלות מוצרים מדהימים",
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ notifications: mockNotifications });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ notifications: mockNotifications });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ notifications: mockNotifications });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", (dbUser as any).id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notifications] list error:", error);
    return NextResponse.json({ notifications: mockNotifications });
  }

  return NextResponse.json({ notifications: data || [] });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = await request.json();
  const { id, read } = body;

  if (!id) {
    return NextResponse.json({ error: "מזהה התראה חסר" }, { status: 400 });
  }

  const { error } = await (supabase
    .from("notifications") as any)
    .update({ read: read ?? true })
    .eq("id", id);

  if (error) {
    console.error("[notifications] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
