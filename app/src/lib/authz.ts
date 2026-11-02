// Pure authorization helpers shared by API routes. No framework imports so they can be unit-tested directly.

export const ALLOWED_REGISTRATION_TYPES = ["creator", "brand"] as const;
export type RegistrationType = (typeof ALLOWED_REGISTRATION_TYPES)[number];

export function isAllowedRegistrationType(value: unknown): value is RegistrationType {
  return typeof value === "string" && (ALLOWED_REGISTRATION_TYPES as readonly string[]).includes(value);
}

// Fields a user may change about their own account through /api/profile
export const USER_EDITABLE_FIELDS = ["full_name"] as const;
export const CREATOR_EDITABLE_FIELDS = [
  "bio",
  "categories",
  "city",
  "tiktok_handle",
  "instagram_handle",
  "tiktok_followers",
  "instagram_followers",
  "date_of_birth",
  "intro_video_url",
] as const;
export const BRAND_EDITABLE_FIELDS = [
  "shop_name",
  "category",
  "categories",
  "website_url",
  "description",
  "logo_url",
] as const;

const NUMERIC_FIELDS = new Set(["tiktok_followers", "instagram_followers"]);
const ARRAY_FIELDS = new Set(["categories"]);

// Returns only allowed keys, with light type normalisation. Unknown or privileged keys are dropped.
export function pickAllowedFields(
  input: unknown,
  allowed: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (NUMERIC_FIELDS.has(key)) {
      const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
      out[key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    } else if (ARRAY_FIELDS.has(key)) {
      out[key] = Array.isArray(value) ? value.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean) : [];
    } else if (value === null || typeof value === "string") {
      out[key] = value;
    }
    // other value types (objects, booleans) are ignored
  }
  return out;
}

export interface ConnectionParties {
  creatorUserId?: string | null;
  brandUserId?: string | null;
}

export type ParticipantRole = "creator" | "brand";

export function participantRole(conn: ConnectionParties, userId: string | null | undefined): ParticipantRole | null {
  if (!userId) return null;
  if (conn.creatorUserId && conn.creatorUserId === userId) return "creator";
  if (conn.brandUserId && conn.brandUserId === userId) return "brand";
  return null;
}

export function isConnectionParticipant(conn: ConnectionParties, userId: string | null | undefined): boolean {
  return participantRole(conn, userId) !== null;
}

// Product fields safe to show to any creator browsing the feed or a product page
export const PUBLIC_PRODUCT_FIELDS = [
  "id",
  "name",
  "description",
  "price",
  "image_url",
  "shipping_policy",
  "source_url",
  "status",
  "product_type",
  "digital_access_type",
  "digital_access_duration_days",
  "expiration_date",
  "quantity",
  "max_creators",
  "created_at",
  "brand_name",
  "brand_user_id",
  "category",
  "categories",
  "logo_url",
] as const;

export function toPublicProduct(product: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_PRODUCT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(product, key)) out[key] = product[key];
  }
  return out;
}

export interface DevLoginEnv {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  ALLOW_DEV_LOGIN?: string;
}

// The test-account login exists only outside production. A Vercel production deployment is always off;
// a local/preview production build must opt in explicitly.
export function devLoginEnabled(env: DevLoginEnv): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production") return env.ALLOW_DEV_LOGIN === "true";
  return true;
}
