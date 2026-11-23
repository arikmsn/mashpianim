"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, useToast } from "@/components/ui";
import { answersSummary, LEAD_STATUSES, LEAD_STATUS_LABELS, quizQuestions, type LeadAnswers, type LeadStatus } from "@/lib/influencer-leads";
import { mergeSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/site-content";

// /admin/leads (design package v3, Phase C): the influencer quiz's leads, newest first, with a status select and
// an admin note. Never prices, availability or influencer profiles: this track is a lead until decided otherwise.
interface LeadRow {
  id: string;
  created_at: string;
  answers: LeadAnswers | null;
  full_name: string;
  business_name: string | null;
  phone: string;
  email: string | null;
  note: string | null;
  source: string;
  utm: Record<string, string> | null;
  status: LeadStatus;
  admin_note: string | null;
  handled_at: string | null;
}

type Filter = LeadStatus | "all";

const statusVariant: Record<LeadStatus, "info" | "warning" | "success" | "default"> = { new: "info", contacted: "warning", qualified: "success", closed: "default" };

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });
  } catch {
    return iso;
  }
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState(SITE_CONTENT_DEFAULTS.quiz);
  const { toast } = useToast();
  const questions = useMemo(() => quizQuestions(quiz), [quiz]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/leads${filter === "all" ? "" : `?status=${filter}`}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { leads?: LeadRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || `שגיאה ${res.status}`);
          setLeads([]);
          return;
        }
        setError(null);
        setLeads(data.leads || []);
      } catch {
        if (cancelled) return;
        setError("אין חיבור לשרת");
        setLeads([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  useEffect(() => {
    fetch("/api/admin/content", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.content) setQuiz(mergeSiteContent(d.content).quiz);
      })
      .catch(() => {});
  }, []);

  async function patch(id: string, body: { status?: LeadStatus; admin_note?: string }) {
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; lead?: Partial<LeadRow> };
      if (!res.ok) {
        toast(data.error || "שגיאה בעדכון", "error");
        return;
      }
      setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...(data.lead || {}) } : l)) : prev));
      toast("עודכן", "success");
    } catch {
      toast("אין חיבור לשרת", "error");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">לידים ממסלול המשפיענים</h1>
          <p className="text-neutral-500 text-sm mt-1">השאלון בדף הבית. כל ליד: התשובות, הפרטים, סטטוס והערה. בלי מחירים ובלי פרופילים, עד שיוחלט אחרת.</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-neutral-100 p-1 rounded-xl">
          {(["all", ...LEAD_STATUSES] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-white shadow-sm text-pink-700" : "text-neutral-500"}`}>
              {f === "all" ? "הכל" : LEAD_STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {leads === null ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-2xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        !error && <p className="text-sm text-neutral-500">עדיין אין לידים.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-900">{lead.business_name || lead.full_name}</span>
                    {lead.business_name && <span className="text-sm text-neutral-500">{lead.full_name}</span>}
                    <Badge variant={statusVariant[lead.status]} size="sm" dot>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                    <a href={`tel:${lead.phone}`} className="font-mono text-pink-700 hover:underline" dir="ltr">{lead.phone}</a>
                    {lead.email && <a href={`mailto:${lead.email}`} className="font-mono text-pink-700 hover:underline" dir="ltr">{lead.email}</a>}
                    <span className="text-neutral-400">{formatWhen(lead.created_at)}</span>
                    {lead.utm && Object.keys(lead.utm).length > 0 && <span className="font-mono text-[11px] text-neutral-400" dir="ltr">{Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(" ")}</span>}
                  </div>
                </div>
                <select value={lead.status} onChange={(e) => patch(lead.id, { status: e.target.value as LeadStatus })} className="px-3 py-2 rounded-xl border border-border-strong bg-white text-sm outline-none focus:border-ink-900">
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {answersSummary(lead.answers, questions, "|")
                  .split("|")
                  .filter(Boolean)
                  .map((part, i) => (
                    <span key={i} className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-800">
                      {part.trim()}
                    </span>
                  ))}
              </div>
              {lead.note && <p className="mt-3 text-sm text-neutral-700 bg-neutral-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{lead.note}</p>}
              <div className="mt-3">
                <label className="block text-xs text-neutral-500 mb-1">הערת אדמין</label>
                <textarea
                  rows={2}
                  value={notes[lead.id] ?? lead.admin_note ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (lead.admin_note || "")) patch(lead.id, { admin_note: v });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-sm outline-none focus:border-ink-900 focus:ring-2 focus:ring-focus-ring/15 resize-y"
                  placeholder="מה סוכם, למי הועבר, מתי חוזרים..."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
