import type { SupabaseClient } from "@supabase/supabase-js";
import { heartClosesWithProduct } from "@/lib/hearts";
import { createNotification, logActivity, notificationData } from "@/lib/notifications";

// A product leaves the site (the business deletes it, or the admin removes it): every heart still waiting on it,
// from either side, mutual or not, is closed with `product_removed` and the creator is told. Approved
// connections (a credit was spent, a chat is open) are untouched. Shared by the business's DELETE and the admin's.
export async function closeWaitingHearts(admin: SupabaseClient, productId: string): Promise<number> {
  const { data: waiting } = await admin
    .from("connections")
    .select("id, status, initiated_by, mutual_at, products(name), creator_profiles!connections_creator_id_fkey(users(id))")
    .eq("product_id", productId)
    .eq("status", "pending");
  let closed = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const conn of (waiting || []) as any[]) {
    if (!heartClosesWithProduct(conn)) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("connections") as any).update({ status: "cancelled", rejection_reason: "product_removed" }).eq("id", conn.id);
    const creatorUser = conn.creator_profiles?.users;
    if (creatorUser?.id) {
      await createNotification({
        userId: creatorUser.id,
        type: "connection_cancelled",
        title: "המוצר הוסר",
        body: `העסק הסיר את המוצר "${conn.products?.name || ""}" מהאתר, ולכן הלב שלך עליו בוטל. אפשר לבחור מוצר אחר.`,
        data: notificationData(conn.id, productId, "creator"),
      });
    }
    await logActivity({ action: "heart_closed_product_removed", entityType: "connection", entityId: conn.id });
    closed++;
  }
  return closed;
}
