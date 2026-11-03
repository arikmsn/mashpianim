import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// The role a session is signed in as (creator / brand / admin). Chosen after the OTP when an account has
// more than one role, enforced server-side: every user-facing route scopes to it, the admin area needs it
// to be "admin". Set by verify-otp / register / dev-login / POST /api/auth/user-type; cleared on logout.
export const ACTIVE_ROLE_COOKIE = "mashpian-role";
export const ACTIVE_ROLES = ["creator", "brand", "admin"] as const;
export type ActiveRole = (typeof ACTIVE_ROLES)[number];

const MAX_AGE_SECONDS = 30 * 24 * 3600;

export function isActiveRole(value: unknown): value is ActiveRole {
  return typeof value === "string" && (ACTIVE_ROLES as readonly string[]).includes(value);
}

// Role from the request cookies (route handlers and server components); null when none was chosen
export async function readActiveRole(): Promise<ActiveRole | null> {
  try {
    const store = await cookies();
    const value = store.get(ACTIVE_ROLE_COOKIE)?.value;
    return isActiveRole(value) ? value : null;
  } catch {
    return null;
  }
}

export function setActiveRoleCookie(response: NextResponse, role: ActiveRole) {
  response.cookies.set(ACTIVE_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearActiveRoleCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_ROLE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function homeForRole(role: ActiveRole): string {
  if (role === "brand") return "/brand";
  if (role === "admin") return "/admin";
  return "/feed";
}
