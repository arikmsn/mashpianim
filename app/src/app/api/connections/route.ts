import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { markMutual, countPortfolioVideos, portfolioGateError, MIN_PORTFOLIO_VIDEOS, notifyHeartSent, notifyBrandOfHeart } from "@/lib/match";
import { isUniqueViolation } from "@/lib/match-errors";
import { getTimelineSettings } from "@/lib/settings";
import { OCCUPYING_STATUSES, isProductFull, brandRevealedToCreator } from "@/lib/connection-flow";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ connections: [] });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  // Always the connections of the role this session is signed in as; platform-wide views live under /api/admin
  const ownProfileId = viewer.role === "brand" ? viewer.brandProfileId : viewer.creatorProfileId;
  if (!ownProfileId) {
    return NextResponse.json({ connections: [], settings: { max_revisions: (await getTimelineSettings(admin)).max_revisions } });
  }

  const { data, error } = await admin
    .from("connections")
    .select(`
      *,
      products(name, image_url, price, product_type),
      creator_profiles!connections_creator_id_fkey(user_id, users(full_name, avatar_url)),
      brand_profiles!connections_brand_id_fkey(user_id, shop_name, logo_url, users(full_name, avatar_url))
    `)
    .eq(viewer.role === "brand" ? "brand_id" : "creator_id", ownProfileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[connections] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיבורים" }, { status: 500 });
  }

  const userId = viewer.userId;
  const readColumn = viewer.role === "brand" ? "brand_read_at" : "creator_read_at";

  // Enrich with unread count and last message — one query for all connections
  const connIds = (data || []).map((c: any) => c.id);
  const byConn = new Map<string, { last: any | null; unread: number }>();
  if (connIds.length > 0) {
    const { data: msgs } = await admin
      .from("messages")
      .select("connection_id, sender_id, text, created_at")
      .in("connection_id", connIds)
      .order("created_at", { ascending: false })
      .limit(3000);
    const readAtByConn = new Map<string, number>(
      (data || []).map((c: any) => [c.id, new Date(c[readColumn] || "1970-01-01T00:00:00Z").getTime()])
    );
    for (const m of (msgs || []) as any[]) {
      const entry = byConn.get(m.connection_id) || { last: null, unread: 0 };
      if (!entry.last) entry.last = m;
      if (m.sender_id !== userId && new Date(m.created_at).getTime() > (readAtByConn.get(m.connection_id) || 0)) {
        entry.unread++;
      }
      byConn.set(m.connection_id, entry);
    }
  }

  const enriched = (data || []).map((conn: any) => {
    const entry = byConn.get(conn.id);
    // A creator's unanswered / declined heart: the business behind it stays anonymous
    if (viewer.role === "creator" && !brandRevealedToCreator(conn)) {
      conn = { ...conn, brand_profiles: { user_id: null, shop_name: "", logo_url: null, users: null }, brand_revealed: false };
    }
    return {
      ...conn,
      unread_count: entry?.unread || 0,
      last_message: entry?.last?.text || null,
      last_message_at: entry?.last?.created_at || conn.created_at,
    };
  });

  // Sort by last message time (most recent first)
  enriched.sort((a: any, b: any) =>
    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  // The UI shows the revision allowance the admin configured
  const timelines = await getTimelineSettings(admin);

  return NextResponse.json({ connections: enriched, settings: { max_revisions: timelines.max_revisions } });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: dbUser } = await admin
    .from("users")
    .select("id, type, full_name, phone")
    .eq("auth_user_id", user.id)
    .single();
  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }
  // `me.type` is the role this session is signed in as; `me.accountType` the account's own type
  const viewerPost = await resolveViewer(admin, user.id, await readActiveRole());
  const me = { ...(dbUser as any), type: viewerPost?.role || (dbUser as any).type, accountType: (dbUser as any).type };

  const body = await request.json();
  const { product_id, creator_user_id } = body;
  if (!product_id) {
    return NextResponse.json({ error: "מזהה מוצר חסר" }, { status: 400 });
  }

  const { data: product } = await admin
    .from("products")
    .select("id, brand_id, status, name, product_type, max_creators, brand_profiles(id, user_id, shop_name, total_credits, used_credits, users(id, full_name, phone))")
    .eq("id", product_id)
    .single();

  if (!product || (product as any).status !== "active") {
    return NextResponse.json({ error: "מוצר לא זמין" }, { status: 404 });
  }

  // No new hearts once a product with a creator limit is full (BRAND-01); products without a limit (the
  // default since 2026-11-04) never fill up. The match itself is re-checked atomically in match_connection()
  const { count: occupied } = await admin
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product_id)
    .in("status", [...OCCUPYING_STATUSES]);
  if (isProductFull((product as any).max_creators, occupied || 0)) {
    return NextResponse.json(
      { error: "המוצר כבר מלא — כל מקומות היוצרים למוצר הזה תפוסים.", code: "product_full" },
      { status: 409 }
    );
  }
  const brandProfile = (product as any).brand_profiles;
  const brandUser = brandProfile?.users;

  // A heart can come from either side
  let initiatedBy: "creator" | "brand";
  let creatorProfileId: string;
  let creatorUserId: string;
  let creatorName = "";
  let creatorPhone: string | null = null;

  // The side a heart comes from is the role this session is signed in as (an admin signed in as a brand
  // hearts like a brand). A session signed in as admin may act for a brand on a product it owns.
  const actsAsBrand = me.type === "brand" || (me.type === "admin" && creator_user_id);
  if (actsAsBrand) {
    if (brandProfile?.user_id !== me.id) {
      return NextResponse.json({ error: "המוצר לא שייך לעסק שלכם" }, { status: 403 });
    }
    if (!creator_user_id) {
      return NextResponse.json({ error: "מזהה יוצר חסר" }, { status: 400 });
    }
    // Hearts are free on both sides; the credit is charged when the brand confirms the match (match_connection)
    const { data: cp } = await admin
      .from("creator_profiles")
      .select("id, user_id, users(id, full_name, phone)")
      .eq("user_id", creator_user_id)
      .single();
    if (!cp) {
      return NextResponse.json({ error: "יוצר/ת לא נמצא/ה" }, { status: 404 });
    }
    initiatedBy = "brand";
    creatorProfileId = (cp as any).id;
    creatorUserId = (cp as any).user_id;
    creatorName = (cp as any).users?.full_name || "";
    creatorPhone = (cp as any).users?.phone || null;
  } else if (me.type === "creator" || me.type === "admin") {
    let { data: creatorProfile } = await admin
      .from("creator_profiles")
      .select("id")
      .eq("user_id", me.id)
      .single();
    if (!creatorProfile && me.type === "admin") {
      const { data: newProfile } = await (admin.from("creator_profiles") as any)
        .insert({ user_id: me.id, categories: ["אופנה"], level: "creator" })
        .select("id")
        .single();
      creatorProfile = newProfile;
    }
    if (!creatorProfile) {
      return NextResponse.json({ error: "לא נמצא פרופיל יוצר" }, { status: 404 });
    }
    if (me.type === "creator") {
      const count = await countPortfolioVideos(admin, me.id);
      if (count < MIN_PORTFOLIO_VIDEOS) {
        return NextResponse.json({ error: portfolioGateError(count), code: "portfolio_gate", count }, { status: 403 });
      }
    }
    initiatedBy = "creator";
    creatorProfileId = (creatorProfile as any).id;
    creatorUserId = me.id;
    creatorName = me.full_name || "";
    creatorPhone = me.phone || null;
  } else {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("connections")
    .select("id, status, initiated_by, mutual_at")
    .eq("creator_id", creatorProfileId)
    .eq("product_id", product_id)
    .not("status", "in", '("cancelled","rejected","completed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const ex = existing as any;
    // The other side already sent a heart on this product → both hearted. The connection stays pending
    // until the brand confirms it (that is the paid step), see markMutual()
    if (ex.status === "pending" && (ex.initiated_by || "creator") !== initiatedBy) {
      if (ex.mutual_at) {
        return NextResponse.json({ error: "כבר יש מאטץ' — ממתינים לאישור העסק", code: "already_mutual" }, { status: 409 });
      }
      const result = await markMutual(admin, ex.id, initiatedBy);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logActivity({
        actorId: me.id,
        action: "connection_mutual",
        entityType: "connection",
        entityId: ex.id,
        details: { product_id, product_name: (product as any).name, initiatedBy },
      });
      return NextResponse.json({ connection: { id: ex.id, status: "pending", mutual: true }, matched: false, mutual: true });
    }
    return NextResponse.json(
      { error: initiatedBy === "brand" ? "כבר שלחתם לב ליוצר/ת על המוצר הזה" : "כבר סימנת לב למוצר הזה" },
      { status: 409 }
    );
  }

  const { data: connection, error } = await admin
    .from("connections")
    .insert({
      creator_id: creatorProfileId,
      brand_id: (product as any).brand_id,
      product_id,
      status: "pending",
      initiated_by: initiatedBy,
      delivery_type: (product as any).product_type || "physical",
    } as any)
    .select()
    .single();

  if (error) {
    // The partial unique index guarantees one active connection per creator/product even under concurrency
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "כבר קיים לב פעיל על המוצר הזה" }, { status: 409 });
    }
    console.error("[connections] create error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הלב" }, { status: 500 });
  }

  const brandName = brandProfile?.shop_name || brandUser?.full_name || "העסק";
  if (initiatedBy === "brand") {
    await notifyHeartSent({
      creatorUserId,
      creatorPhone,
      brandName,
      productName: (product as any).name,
      connectionId: (connection as any).id,
      productId: (product as any).id,
    });
  } else if (brandUser) {
    await notifyBrandOfHeart({
      brandUserId: brandUser.id,
      brandPhone: brandUser.phone,
      creatorName: creatorName || "יוצר/ת",
      productName: (product as any).name,
      connectionId: (connection as any).id,
      productId: (product as any).id,
    });
  }

  await logActivity({
    actorId: me.id,
    action: "heart_sent",
    entityType: "connection",
    entityId: (connection as any).id,
    details: { product_id, product_name: (product as any).name, initiatedBy },
  });

  return NextResponse.json({ connection, matched: false, mutual: false }, { status: 201 });
}
