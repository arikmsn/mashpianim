import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Never run the session middleware for static files served from `public/`: the service worker (`sw.js`),
  // the offline page, the manifest and every image/font must load for signed-out visitors too, otherwise the
  // PWA can't register or install before login (the redirect to /login used to break exactly that).
  matcher: [
    "/((?!_next/static|_next/image|sw\\.js|offline\\.html|manifest\\.json|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
