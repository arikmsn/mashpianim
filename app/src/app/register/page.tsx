import { getSiteContent } from "@/lib/site-content-server";
import { RegisterClient } from "./register-client";

// The registration screens, coloured by the account type (design package v3, AuthScreen). The texts come from
// the auth section of the content registry; the steps, fields and API calls live in register-client.tsx.
export const revalidate = 60;

export default async function RegisterPage() {
  const { content } = await getSiteContent();
  return <RegisterClient texts={content.auth} />;
}
