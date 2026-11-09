// Pure authorization helpers shared by API routes. No framework imports so they can be unit-tested directly.
// Explicit extension so `node --test` (tests/*.test.ts import this file directly) can resolve it too
import { isProductCategory, cleanCustomCategory } from "./categories.ts";
import { sanitizeBriefData } from "./brief.ts";

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
  "region",
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
  "status",
  "product_type",
  "digital_access_type",
  "digital_access_duration_days",
  "expiration_date",
  "quantity",
  "max_creators",
  "occupied",
  "spots_left",
  "created_at",
  "brand_name",
  "brand_user_id",
  "category",
  "category_custom",
  "categories",
  "logo_url",
  "brand_region",
  "brand_revealed",
] as const;

export function toPublicProduct(product: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_PRODUCT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(product, key)) out[key] = product[key];
  }
  return out;
}

// Looks up a role in a config map using own properties only, so prototype keys
// ("__proto__", "constructor", "toString") can never resolve to a value.
export function resolveDevRole<T>(role: unknown, config: Record<string, T>): T | null {
  if (typeof role !== "string" || role.length === 0) return null;
  if (!Object.hasOwn(config, role)) return null;
  return config[role];
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

// --- Products -------------------------------------------------------------------------------------

// Fields a brand may change on its own product through PUT /api/products/[id].
// `category` is the product's own feed category (migration 013) and is validated against the shared list
// below; unknown values are dropped rather than failing the whole edit (FUNC-02).
export const PRODUCT_EDITABLE_FIELDS = [
  "name",
  "description",
  "price",
  "image_url",
  "shipping_policy",
  "shipping_address",
  "source_url",
  "status",
  "product_type",
  "digital_access_type",
  "digital_access_instructions",
  "digital_access_duration_days",
  "expiration_date",
  "quantity",
  "brief",
  "brief_data",
  "max_creators",
  "category",
  "category_custom",
] as const;

const PRODUCT_NUMERIC_FIELDS = new Set(["price", "quantity", "digital_access_duration_days", "max_creators"]);

// Returns only allowed, present keys. Numeric fields accept numbers or numeric strings (null/"" clears the
// optional ones, never the price); `category` must be one of the feed categories; everything else must be
// a string or null. Unknown keys and other types are dropped. The database still validates enums and
// NOT NULL columns.
export function pickProductUpdates(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const key of PRODUCT_EDITABLE_FIELDS) {
    if (!Object.hasOwn(input, key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (key === "category") {
      if (isProductCategory(value)) out[key] = value;
      continue;
    }
    if (key === "category_custom") {
      // null / "" clears the label; a typed value is trimmed and bounded
      out[key] = value === null ? null : cleanCustomCategory(value);
      continue;
    }
    if (key === "brief_data") {
      // null clears; an object is reduced to known sections/options; anything else is dropped
      if (value === null) out[key] = null;
      else if (typeof value === "object" && !Array.isArray(value)) out[key] = sanitizeBriefData(value);
      continue;
    }
    if (PRODUCT_NUMERIC_FIELDS.has(key)) {
      if (value === null || value === "") {
        if (key !== "price") out[key] = null; // max_creators null = no limit (2026-11-04)
        continue;
      }
      const n = typeof value === "number" ? value : Number(String(value));
      if (!Number.isFinite(n) || n < 0) continue;
      if (key === "max_creators") {
        if (n >= 1) out[key] = Math.min(50, Math.floor(n)); // at least one creator per product
      } else {
        out[key] = key === "price" ? n : Math.floor(n);
      }
    } else if (value === null || typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

// --- Storage paths --------------------------------------------------------------------------------
// Browser uploads may only land in the caller's own folder, portfolio/<auth uid>/..., which is exactly what
// the storage INSERT policies allow. The metadata routes use these checks so a row can never point at a
// file the caller did not upload.

function ownPathRest(path: unknown, authUserId: string): string[] | null {
  if (typeof path !== "string" || !authUserId) return null;
  const parts = path.split("/");
  if (parts.length < 3 || parts[0] !== "portfolio" || parts[1] !== authUserId) return null;
  if (parts.some((p) => p.length === 0 || p === "." || p === "..")) return null;
  return parts.slice(2);
}

// portfolio/<uid>/<file>
export function isOwnPortfolioPath(path: unknown, authUserId: string): boolean {
  const rest = ownPathRest(path, authUserId);
  return !!rest && rest.length === 1;
}

// portfolio/<uid>/connections/<connectionId>/<file>
export function isOwnConnectionVideoPath(path: unknown, authUserId: string, connectionId: string): boolean {
  const rest = ownPathRest(path, authUserId);
  return !!rest && !!connectionId && rest.length === 3 && rest[0] === "connections" && rest[1] === connectionId;
}

export function isImagePath(path: unknown): boolean {
  return typeof path === "string" && /\.(jpe?g|png|webp)$/i.test(path);
}

// Object path inside the public `thumbnails` bucket, taken from the URL stored on a video row
export function thumbnailPathFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(/\/storage\/v1\/object\/public\/thumbnails\/([^?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

// --- Connection videos ----------------------------------------------------------------------------

// A creator may upload deliverables once the product arrived (or a revision was requested), and keep adding
// options while the brand has not decided yet (owner, 2026-11-09: "she will send a few and the business picks")
export const CONNECTION_UPLOAD_STATUSES = ["delivered", "filming", "revision_requested", "uploaded", "in_review"] as const;

export function canUploadConnectionVideo(status: unknown): boolean {
  return typeof status === "string" && (CONNECTION_UPLOAD_STATUSES as readonly string[]).includes(status);
}
