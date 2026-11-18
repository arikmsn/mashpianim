// The two home screens: the device Back button there would leave the app entirely, because the history entry
// behind them is the login / phone-verification screen. Every other screen has an in-app screen behind it, so
// Back there is normal navigation and must not be guarded. Owner, 2026-11-18: on Android a habitual Back from the
// home screen dropped the user onto the verification screen — ask before leaving. Pure (unit-tested); the dialog
// lives in components/features/exit-guard.tsx.
export function isExitGuardScreen(pathname: string | null | undefined): boolean {
  return pathname === "/feed" || pathname === "/brand";
}
