import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export type UserType = "creator" | "brand" | "admin";
export type UiRole = "creator" | "brand";

export interface Viewer {
  userId: string;
  type: UserType;
  isAdmin: boolean;
  // The side of the marketplace this account acts on in the app. Admins use the regular screens too:
  // they act as a creator when they have a creator profile (the profile route creates one), else as a brand.
  role: UiRole;
  creatorProfileId: string | null;
  brandProfileId: string | null;
}

export function effectiveRole(type: UserType, creatorProfileId: string | null, brandProfileId: string | null): UiRole {
  if (type === "brand") return "brand";
  if (type === "creator") return "creator";
  if (creatorProfileId) return "creator";
  if (brandProfileId) return "brand";
  return "creator";
}

// Resolves the signed-in app user with their profiles and the side they act on. Never "admin sees all":
// user-facing routes must scope to the viewer's own profile; admin-wide views live under /api/admin.
export async function resolveViewer(admin: Admin, authUserId: string): Promise<Viewer | null> {
  const { data: dbUser } = await admin.from("users").select("id, type").eq("auth_user_id", authUserId).maybeSingle();
  if (!dbUser) return null;
  const userId = (dbUser as { id: string }).id;
  const type = ((dbUser as { type: string }).type || "creator") as UserType;

  const [{ data: cp }, { data: bp }] = await Promise.all([
    admin.from("creator_profiles").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("brand_profiles").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const creatorProfileId = (cp as { id: string } | null)?.id || null;
  const brandProfileId = (bp as { id: string } | null)?.id || null;

  return {
    userId,
    type,
    isAdmin: type === "admin",
    role: effectiveRole(type, creatorProfileId, brandProfileId),
    creatorProfileId,
    brandProfileId,
  };
}
