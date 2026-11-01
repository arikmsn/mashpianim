import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type NotifyParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function createNotification(params: NotifyParams) {
  const supabase = getAdminClient();
  if (!supabase) return;

  await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data || null,
  } as any);
}

export async function logActivity(params: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  const supabase = getAdminClient();
  if (!supabase) return;

  await supabase.from("activity_log").insert({
    actor_id: params.actorId || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    details: params.details || null,
  } as any);
}

type ConnectionStatusLabel = {
  he: string;
  notifyCreator?: NotifyParams | null;
  notifyBrand?: NotifyParams | null;
};

export function getConnectionStatusMessages(
  newStatus: string,
  context: {
    connectionId: string;
    productName: string;
    creatorName: string;
    brandName: string;
    creatorUserId: string;
    brandUserId: string;
  }
): ConnectionStatusLabel {
  const { connectionId, productName, creatorName, brandName, creatorUserId, brandUserId } = context;
  const data = { connectionId };

  const map: Record<string, ConnectionStatusLabel> = {
    approved: {
      he: "מאושר",
      notifyCreator: {
        userId: creatorUserId,
        type: "connection_approved",
        title: "בקשת חיבור אושרה!",
        body: `${brandName} אישרו את הבקשה שלך למוצר "${productName}"`,
        data,
      },
    },
    rejected: {
      he: "נדחה",
      notifyCreator: {
        userId: creatorUserId,
        type: "connection_rejected",
        title: "בקשת חיבור נדחתה",
        body: `${brandName} דחו את הבקשה שלך למוצר "${productName}"`,
        data,
      },
    },
    shipped: {
      he: "נשלח",
      notifyCreator: {
        userId: creatorUserId,
        type: "product_shipped",
        title: "המוצר בדרך אליך!",
        body: `${brandName} שלחו את "${productName}". אשרו קבלה כשהמוצר מגיע.`,
        data,
      },
    },
    delivered: {
      he: "נמסר",
      notifyBrand: {
        userId: brandUserId,
        type: "product_delivered",
        title: "המוצר נמסר!",
        body: `${creatorName} אישר/ה שקיבל/ה את "${productName}". הצילום מתחיל עכשיו.`,
        data,
      },
    },
    filming: {
      he: "בצילום",
    },
    uploaded: {
      he: "הועלה",
      notifyBrand: {
        userId: brandUserId,
        type: "video_uploaded",
        title: "סרטון חדש הועלה!",
        body: `${creatorName} העלה/תה סרטון עבור "${productName}". ממתין לסקירה.`,
        data,
      },
    },
    in_review: {
      he: "בבדיקה",
    },
    completed: {
      he: "הושלם",
      notifyCreator: {
        userId: creatorUserId,
        type: "connection_completed",
        title: "החיבור הושלם!",
        body: `הסרטון שלך למוצר "${productName}" אושר. כל הכבוד!`,
        data,
      },
      notifyBrand: {
        userId: brandUserId,
        type: "connection_completed",
        title: "הסרטון מוכן!",
        body: `הסרטון של ${creatorName} עבור "${productName}" אושר ומוכן לשימוש.`,
        data,
      },
    },
    revision_requested: {
      he: "בקשת תיקון",
      notifyCreator: {
        userId: creatorUserId,
        type: "revision_requested",
        title: "נדרש תיקון בסרטון",
        body: `התבקשת לתקן את הסרטון עבור "${productName}". בדקו את ההערות.`,
        data,
      },
    },
    cancelled: {
      he: "בוטל",
      notifyCreator: {
        userId: creatorUserId,
        type: "connection_cancelled",
        title: "חיבור בוטל",
        body: `החיבור למוצר "${productName}" בוטל.`,
        data,
      },
      notifyBrand: {
        userId: brandUserId,
        type: "connection_cancelled",
        title: "חיבור בוטל",
        body: `החיבור עם ${creatorName} למוצר "${productName}" בוטל.`,
        data,
      },
    },
  };

  return map[newStatus] || { he: newStatus };
}

export async function notifyConnectionStatusChange(
  newStatus: string,
  context: Parameters<typeof getConnectionStatusMessages>[1]
) {
  const msgs = getConnectionStatusMessages(newStatus, context);
  const promises: Promise<void>[] = [];

  if (msgs.notifyCreator) promises.push(createNotification(msgs.notifyCreator));
  if (msgs.notifyBrand) promises.push(createNotification(msgs.notifyBrand));

  if (promises.length > 0) await Promise.all(promises);
}
