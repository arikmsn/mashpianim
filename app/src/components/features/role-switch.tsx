"use client";

import { useEffect, useState } from "react";
import { Modal, useToast } from "@/components/ui";
import { clearCache, fetchJson } from "@/lib/client-cache";

export type AppRole = "creator" | "brand" | "admin";

export const ROLE_OPTIONS: Record<AppRole, { label: string; desc: string; icon: string }> = {
  creator: { label: "ממשק יוצר תוכן", desc: "פיד, פרופיל, חיבורים", icon: "🎬" },
  brand: { label: "ממשק מפרסם", desc: "מוצרים, יוצרים, סרטונים", icon: "🏪" },
  admin: { label: "ממשק ניהול", desc: "משתמשים, מודרציה, הגדרות", icon: "🛡️" },
};

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_OPTIONS ? ROLE_OPTIONS[role as AppRole].label : "";
}

// Chooses the role for this session (POST /api/auth/user-type) and goes to that role's home.
// Used after the OTP when an account holds several roles, and from the profile to switch.
export async function chooseRole(role: AppRole): Promise<{ ok: boolean; redirect?: string; error?: string }> {
  const res = await fetch("/api/auth/user-type", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "שגיאה בבחירת ממשק" };
  return { ok: true, redirect: (data as { redirect?: string }).redirect };
}

export function RoleOptions({ roles, current, busy, onPick }: { roles: AppRole[]; current?: AppRole | null; busy?: boolean; onPick: (role: AppRole) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {roles.map((role) => {
        const opt = ROLE_OPTIONS[role];
        const isCurrent = role === current;
        return (
          <button
            key={role}
            type="button"
            disabled={busy || isCurrent}
            onClick={() => onPick(role)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-right transition-colors disabled:opacity-60 ${
              isCurrent ? "border-pink-300 bg-pink-50" : "border-neutral-200 hover:bg-pink-50 hover:border-pink-200"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center shrink-0 text-xl">{opt.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{opt.label}</p>
              <p className="text-xs text-neutral-400">{opt.desc}</p>
            </div>
            {isCurrent && <span className="text-[11px] text-pink-500 font-medium">מחובר/ת</span>}
          </button>
        );
      })}
    </div>
  );
}

// Compact switcher for the admin sidebar: one button per other role the account holds
export function AdminRoleSwitch() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJson<{ roles?: string[] }>("/api/profile").then((d) => {
      const list = Array.isArray(d?.roles) ? (d!.roles as AppRole[]) : [];
      setRoles(list.filter((r) => r !== "admin"));
    });
  }, []);

  if (roles.length === 0) return null;

  async function pick(role: AppRole) {
    setBusy(true);
    const result = await chooseRole(role);
    setBusy(false);
    if (!result.ok) {
      toast(result.error || "שגיאה בבחירת ממשק", "error");
      return;
    }
    clearCache();
    window.location.assign(result.redirect || "/");
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-white/40">מעבר לממשק אחר</p>
      {roles.map((role) => (
        <button
          key={role}
          type="button"
          disabled={busy}
          onClick={() => pick(role)}
          className="w-full text-right text-xs text-white/70 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {ROLE_OPTIONS[role].icon} {ROLE_OPTIONS[role].label}
        </button>
      ))}
    </div>
  );
}

export function RoleSwitchModal({ open, onClose, roles, current }: { open: boolean; onClose: () => void; roles: AppRole[]; current: AppRole | null }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function pick(role: AppRole) {
    setBusy(true);
    const result = await chooseRole(role);
    setBusy(false);
    if (!result.ok) {
      toast(result.error || "שגיאה בבחירת ממשק", "error");
      return;
    }
    clearCache();
    toast(`עוברים ל${ROLE_OPTIONS[role].label}`, "success");
    // The role cookie changed on the server; a full navigation starts the new role cleanly
    window.location.assign(result.redirect || "/");
  }

  return (
    <Modal open={open} onClose={onClose} title="החלפת ממשק" size="sm">
      <p className="text-sm text-neutral-500 mb-4">החשבון הזה רשום ביותר מתפקיד אחד. בחרו באיזה ממשק להמשיך.</p>
      <RoleOptions roles={roles} current={current} busy={busy} onPick={pick} />
    </Modal>
  );
}
