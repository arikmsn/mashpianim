// Switch for every WhatsApp send that is NOT a login code (owner, 2026-11-12): the welcome message after
// registration and the heart / match messages. In-app bell notifications are untouched.
//
// Why off by default: the number connected to GreenAPI (an unofficial automation) is the owner's main business
// WhatsApp, and WhatsApp restricted it the day after launch for "automated or bulk messages". While restricted
// these messages are not delivered anyway, and every further automated send risks escalation to a permanent
// ban. Set WHATSAPP_NOTIFICATIONS=on in Vercel (and redeploy) to send them again — or, better, when the
// notifications move to the official WhatsApp Business Platform on a dedicated number.
//
// Pure: the env value is a parameter so it can be unit-tested.
export function whatsappNotificationsEnabled(env: string | undefined | null = process.env.WHATSAPP_NOTIFICATIONS): boolean {
  return (env || "").trim().toLowerCase() === "on";
}
