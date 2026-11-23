import { getSiteContent } from "@/lib/site-content-server";
import { LoginClient } from "./login-client";

// The login screen, coloured by the account type (design package v3, AuthScreen). The texts come from the auth
// section of the content registry; the OTP flow itself lives in login-client.tsx and did not change.
export const revalidate = 60;

export default async function LoginPage() {
  const { content } = await getSiteContent();
  return <LoginClient texts={content.auth} />;
}
