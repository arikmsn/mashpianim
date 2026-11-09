import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// How long the session check may take before the page request goes through without it. During the
// 2026-11-09 request flood Supabase Auth answered in 4–100 s and every request hung behind this call until
// Vercel stopped the middleware at 25 s. A page that goes through unchecked still cannot read anything: its
// API calls answer 401 and the client sends the visitor to /login.
const AUTH_TIMEOUT_MS = 4000;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // API routes authenticate themselves: every handler calls auth.getUser() and refreshes the session cookies
  // on its own. Doing it here too doubled each request's Auth traffic and gained nothing.
  if (pathname.startsWith("/api/")) return supabaseResponse;

  if (
    !process.env.NEXT_SUPABASE_URL ||
    !process.env.NEXT_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const user = await userWithinTimeout(supabase);
  // Auth slow or unreachable: let the request through rather than hang or bounce a signed-in visitor to /login
  if (user === "unavailable") return supabaseResponse;

  // Public routes that don't require auth
  const publicRoutes = ["/", "/login", "/register", "/about", "/terms", "/privacy", "/refunds"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route) || pathname.startsWith("/auth/");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

async function userWithinTimeout(supabase: SupabaseClient): Promise<User | null | "unavailable"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"unavailable">((resolve) => {
    timer = setTimeout(() => resolve("unavailable"), AUTH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      supabase.auth.getUser().then(({ data }) => data.user),
      timeout,
    ]);
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}
