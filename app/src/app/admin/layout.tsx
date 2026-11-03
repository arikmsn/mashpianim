import { notFound, redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/admin-auth";
import AdminShell from "./admin-shell";

// The admin area is decided on the server from the session's role (SEC-11): anonymous visitors go to
// login, signed-in non-admins see a 404 so the area's existence isn't confirmed. The API routes keep
// their own checks; this only stops the pages from rendering.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, userId } = await verifyAdmin();
  if (!userId) redirect("/login?redirect=/admin");
  if (!isAdmin) notFound();
  return <AdminShell>{children}</AdminShell>;
}
