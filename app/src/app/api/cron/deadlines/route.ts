import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification, logActivity } from "@/lib/notifications";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Called by Vercel Cron (Authorization: Bearer <CRON_SECRET>, sent automatically)
// or by an external scheduler via GET /api/cron/deadlines?secret=<CRON_SECRET>
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = request.nextUrl.searchParams.get("secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!cronSecret || (querySecret !== cronSecret && bearer !== cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const results = { expired: 0, cancelled: 0, warnings: 0, flagged: 0 };

  // 0. Hearts left unanswered for 7 days expire
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: staleHearts } = await supabase
    .from("connections")
    .select(`
      id, initiated_by,
      products(name),
      creator_profiles!connections_creator_id_fkey(users(id)),
      brand_profiles!connections_brand_id_fkey(users(id))
    `)
    .eq("status", "pending")
    .lt("created_at", sevenDaysAgo);

  for (const conn of (staleHearts || []) as any[]) {
    await supabase.from("connections").update({
      status: "cancelled",
      rejection_reason: "expired",
    } as any).eq("id", conn.id);

    const senderUser = conn.initiated_by === "brand" ? conn.brand_profiles?.users : conn.creator_profiles?.users;
    if (senderUser) {
      await createNotification({
        userId: senderUser.id,
        type: "heart_expired",
        title: "הלב פג",
        body: `הלב למוצר "${conn.products?.name || ""}" לא נענה תוך 7 ימים ובוטל. אפשר לנסות שוב או לבחור מישהו אחר.`,
        data: { connectionId: conn.id },
      });
    }
    await logActivity({ action: "heart_expired", entityType: "connection", entityId: conn.id });
    results.expired++;
  }

  // 1. Ship deadline passed (approved but not shipped in 7 days) → warn at 5d, cancel at 14d
  const { data: overdueShipping } = await supabase
    .from("connections")
    .select(`
      id, status, ship_deadline, brand_id, creator_id,
      products(name),
      creator_profiles!connections_creator_id_fkey(users(id, full_name)),
      brand_profiles!connections_brand_id_fkey(user_id, total_credits, used_credits, shop_name, users(id, full_name))
    `)
    .eq("status", "approved")
    .lt("ship_deadline", now);

  for (const conn of (overdueShipping || []) as any[]) {
    const daysPast = Math.floor((Date.now() - new Date(conn.ship_deadline).getTime()) / 86400000);

    if (daysPast >= 7) {
      // Auto-cancel after 14 days total (7 deadline + 7 grace)
      await supabase.from("connections").update({
        status: "cancelled",
      } as any).eq("id", conn.id);

      // Refund credit
      if (conn.brand_profiles) {
        const used = conn.brand_profiles.used_credits || 0;
        await supabase.from("brand_profiles").update({
          used_credits: Math.max(0, used - 1),
        } as any).eq("id", conn.brand_id);
      }

      const brandUser = conn.brand_profiles?.users;
      const creatorUser = conn.creator_profiles?.users;

      if (brandUser) {
        await createNotification({
          userId: brandUser.id,
          type: "connection_auto_cancelled",
          title: "חיבור בוטל אוטומטית",
          body: `החיבור למוצר "${conn.products?.name}" בוטל כי המוצר לא נשלח בזמן. הפנייה הוחזרה.`,
          data: { connectionId: conn.id },
        });
      }
      if (creatorUser) {
        await createNotification({
          userId: creatorUser.id,
          type: "connection_auto_cancelled",
          title: "חיבור בוטל",
          body: `החיבור למוצר "${conn.products?.name}" בוטל כי העסק לא שלח את המוצר.`,
          data: { connectionId: conn.id },
        });
      }

      await logActivity({
        action: "auto_cancel_shipping_overdue",
        entityType: "connection",
        entityId: conn.id,
        details: { daysPast: daysPast + 7 },
      });
      results.cancelled++;
    } else {
      // Warning to brand
      const brandUser = conn.brand_profiles?.users;
      if (brandUser) {
        await createNotification({
          userId: brandUser.id,
          type: "shipping_deadline_warning",
          title: "תזכורת: שלחו את המוצר!",
          body: `עבר מועד השליחה למוצר "${conn.products?.name}". שלחו בהקדם או שהחיבור יבוטל.`,
          data: { connectionId: conn.id },
        });
      }
      results.warnings++;
    }
  }

  // 2. Film deadline passed (delivered but not uploaded in 10 days)
  const { data: overdueFilming } = await supabase
    .from("connections")
    .select(`
      id, status, film_deadline, creator_id, brand_id, credit_deducted,
      products(name),
      creator_profiles!connections_creator_id_fkey(users(id, full_name)),
      brand_profiles!connections_brand_id_fkey(user_id, total_credits, used_credits, users(id, full_name))
    `)
    .in("status", ["delivered", "filming"])
    .lt("film_deadline", now);

  for (const conn of (overdueFilming || []) as any[]) {
    const daysPast = Math.floor((Date.now() - new Date(conn.film_deadline).getTime()) / 86400000);

    if (daysPast >= 5) {
      // Auto-cancel after 15 days total
      await supabase.from("connections").update({
        status: "cancelled",
      } as any).eq("id", conn.id);

      if (conn.credit_deducted && conn.brand_profiles) {
        const used = conn.brand_profiles.used_credits || 0;
        await supabase.from("brand_profiles").update({
          used_credits: Math.max(0, used - 1),
        } as any).eq("id", conn.brand_id);
      }

      // Flag creator for not delivering
      await logActivity({
        action: "auto_cancel_filming_overdue",
        entityType: "connection",
        entityId: conn.id,
        details: { daysPast: daysPast + 10, creator_id: conn.creator_id },
      });
      results.cancelled++;
    } else {
      const creatorUser = conn.creator_profiles?.users;
      if (creatorUser) {
        await createNotification({
          userId: creatorUser.id,
          type: "filming_deadline_warning",
          title: "תזכורת: העלו סרטון!",
          body: `עבר מועד הצילום למוצר "${conn.products?.name}". העלו סרטון בהקדם.`,
          data: { connectionId: conn.id },
        });
      }
      results.warnings++;
    }
  }

  // 3. Review deadline passed (in_review for more than 7 days) → auto-approve
  const { data: overdueReview } = await supabase
    .from("connections")
    .select(`
      id, status, review_deadline, brand_id, creator_id,
      products(name),
      creator_profiles!connections_creator_id_fkey(users(id, full_name)),
      brand_profiles!connections_brand_id_fkey(users(id, full_name))
    `)
    .eq("status", "in_review")
    .lt("review_deadline", now);

  for (const conn of (overdueReview || []) as any[]) {
    const daysPast = Math.floor((Date.now() - new Date(conn.review_deadline).getTime()) / 86400000);

    if (daysPast >= 3) {
      // Auto-complete: brand didn't respond in 10 days total
      await supabase.from("connections").update({
        status: "completed",
        completed_at: now,
      } as any).eq("id", conn.id);

      // Mark videos as downloadable
      await supabase.from("videos").update({
        is_downloadable: true,
      } as any).eq("connection_id", conn.id).eq("status", "approved");

      await logActivity({
        action: "auto_complete_review_overdue",
        entityType: "connection",
        entityId: conn.id,
      });
      results.flagged++;
    } else {
      const brandUser = conn.brand_profiles?.users;
      if (brandUser) {
        await createNotification({
          userId: brandUser.id,
          type: "review_deadline_warning",
          title: "תזכורת: אשרו את הסרטון!",
          body: `מועד הסקירה למוצר "${conn.products?.name}" עבר. אם לא תגיבו, הסרטון יאושר אוטומטית.`,
          data: { connectionId: conn.id },
        });
      }
      results.warnings++;
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now,
    results,
  });
}
