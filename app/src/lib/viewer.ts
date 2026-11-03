import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export type UserType = "creator" | "brand" | "admin";
export type UiRole = "creator" | "brand" | "admin";

export interface Viewer {
  userId: string;
  type: UserType;
  isAdmin: boolean;
  // The role this session acts as. One account can hold several (an admin with a creator profile, a phone
  // registered as both creator and brand); the session picks one at login and sees only that side.
  role: UiRole;
  // Every role the account may sign in as
  roles: UiRole[];
  creatorProfileId: string | null;
  brandProfileId: string | null;
}

export function availableRoles(type: UserType, creatorProfileId: string | null, brandProfileId: string | null): UiRole[] {
  const roles: UiRole[] = [];
  if (type === "creator" || creatorProfileId) roles.push("creator");
  if (type === "brand" || brandProfileId) roles.push("brand");
  if (type === "admin") roles.push("admin");
  return roles;
}

// The role a session acts as: the chosen one when valid for this account, else the account's own type.
// Sessions opened before role selection existed (no cookie) keep the old behaviour: an admin with a creator
// profile acts as a creator.
export function effectiveRole(
  type: UserType,
  creatorProfileId: string | null,
  brandProfileId: string | null,
  activeRole: string | null | undefined = null
): UiRole {
  const roles = availableRoles(type, creatorProfileId, brandProfileId);
  if (activeRole && (roles as string[]).includes(activeRole)) return activeRole as UiRole;
  if (type === "brand") return "brand";
  if (type === "creator") return "creator";
  if (creatorProfileId) return "creator";
  if (brandProfileId) return "brand";
  return "admin";
}

// Resolves the signed-in app user with their profiles and the role this session acts as. Never
// "admin sees all": user-facing routes scope to the viewer's own profile; admin-wide views live under
// /api/admin and require role === "admin".
export async function resolveViewer(admin: Admin, authUserId: string, activeRole: string | null = null): Promise<Viewer | null> {
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
    role: effectiveRole(type, creatorProfileId, brandProfileId, activeRole),
    roles: availableRoles(type, creatorProfileId, brandProfileId),
    creatorProfileId,
    brandProfileId,
  };
}
