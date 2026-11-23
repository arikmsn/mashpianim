"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CreditsAccess } from "@/components/features";
import { fetchJson, readCache, swrFetch } from "@/lib/client-cache";
import { BILLING_CONTENT_DEFAULTS, fillTemplate, mergeBillingContent, parseBullets, parseFaq, type BillingContent } from "@/lib/billing-content";
import { formatILS, savingsVsSingle, type PackageId, type PackageOffer } from "@/lib/payments";
import { formatDateHe } from "@/lib/dates";

type PackagesPayload = {
  enabled: boolean;
  mode: string;
  packages: PackageOffer[];
  discount?: { pct: number; eligible: boolean };
  single_price?: number;
  balance?: { total: number; used: number; remaining: number };
};

type Order = { id: string; created_at: string; completed_at: string | null; package: string | null; credits: number; amount: number; status: string; payment_id: string | null; document_id: string | null };
type Movement = { at: string; delta: number | null; text: string; kind: "purchase" | "match" | "refund" | "team" };
type HistoryPayload = { orders: Order[]; movements: Movement[] };

const orderStatus: Record<string, { label: string; cls: string }> = {
  completed: { label: "שולם", cls: "text-emerald-700 bg-emerald-50" },
  pending: { label: "ממתין לתשלום", cls: "text-amber-700 bg-amber-50" },
  failed: { label: "לא הושלם", cls: "text-neutral-500 bg-neutral-100" },
  refunded: { label: "הוחזר", cls: "text-neutral-500 bg-neutral-100" },
};

// The business's "סרטונים וחיוב" page (owner, 2026-11-16): the balance, the packages (with the first-purchase
// discount when it applies), how payment works, what a video includes, the FAQ, and the orders / movements.
// Every string comes from /admin → תוכן האתר (lib/billing-content.ts); the purchase itself runs through the
// same sheet as everywhere else (CreditsAccess → /api/payments/checkout → SUMIT).
export default function BrandBillingPage() {
  const [content, setContent] = useState<BillingContent>(() => {
    const cached = readCache<{ content?: unknown }>("/api/admin/content");
    return cached ? mergeBillingContent(cached.content) : { ...BILLING_CONTENT_DEFAULTS };
  });
  const [offer, setOffer] = useState<PackagesPayload | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [selected, setSelected] = useState<PackageId | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [tab, setTab] = useState<"orders" | "movements">("orders");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [includesOpen, setIncludesOpen] = useState(false);

  useEffect(() => {
    swrFetch<{ content?: unknown }>("/api/admin/content", (data) => setContent(mergeBillingContent(data?.content)));
    fetchJson<PackagesPayload>("/api/payments/packages").then((d) => {
      if (!d || !Array.isArray(d.packages)) return;
      setOffer(d);
      const best = d.packages.find((p) => p.best) || d.packages[0];
      if (best) setSelected((s) => s || best.id);
    });
    fetchJson<HistoryPayload>("/api/payments/history").then((d) => setHistory(d && Array.isArray(d.orders) ? d : { orders: [], movements: [] }));
  }, []);

  const packages = offer?.packages || [];
  const chosen = packages.find((p) => p.id === selected) || null;
  const balance = offer?.balance || { total: 0, used: 0, remaining: 0 };
  const discount = offer?.discount && offer.discount.pct > 0 && offer.discount.eligible ? offer.discount.pct : 0;
  // Against buying the same number of videos one by one (at the same discount level)
  const singleEffective = packages.find((p) => p.id === "single")?.price ?? offer?.single_price ?? 0;
  const saving = chosen && singleEffective ? savingsVsSingle(chosen, singleEffective) : 0;
  const faq = parseFaq(content.faq);
  const includes = parseBullets(content.includes_body);
  const showReferral = content.referral_title.trim().length > 0 && content.referral_body.trim().length > 0;
  const nameOf = (p: PackageOffer) => content[`package_name_${p.id}`] || p.label;

  return (
    <main className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/brand" aria-label="חזרה" className="p-2 -mr-2 rounded-lg hover:bg-neutral-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <h1 className="text-xl font-bold">🎬 {content.title}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Balance */}
        <Card padding="md">
          <p className="text-xs text-neutral-500">{content.balance_label}</p>
          <p className="text-3xl font-bold mt-1">
            {offer ? (balance.remaining === 0 ? "אין סרטונים" : `${balance.remaining} ${balance.remaining === 1 ? "סרטון" : "סרטונים"}`) : "…"}
            {offer && balance.total > 0 && <span className="text-sm font-normal text-neutral-400"> מתוך {balance.total}</span>}
          </p>
          <p className="text-sm text-neutral-600 mt-2">{content.balance_note}</p>
        </Card>

        {/* Packages */}
        <section className="space-y-3">
          <h2 className="font-bold text-lg">{content.packages_title}</h2>
          {discount > 0 && (
            <div className="rounded-2xl bg-pink-50 border border-pink-100 px-4 py-3 flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">🎁</span>
              <div>
                <p className="font-semibold text-sm text-pink-700">{fillTemplate(content.discount_title, { pct: discount })}</p>
                <p className="text-xs text-pink-600/80 mt-0.5">{content.discount_note}</p>
              </div>
            </div>
          )}
          {!offer ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 rounded-2xl bg-white border border-neutral-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {packages.map((p) => {
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    aria-pressed={active}
                    className={`relative text-right rounded-2xl border p-4 transition-all ${active ? "border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "border-neutral-100 bg-white hover:border-pink-200"}`}
                  >
                    {p.discountPct ? (
                      <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-white text-pink-600" : "bg-pink-500 text-white"}`}>-{p.discountPct}%</span>
                    ) : p.best ? (
                      <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-white text-pink-600" : "bg-emerald-500 text-white"}`}>הכי משתלם</span>
                    ) : null}
                    <p className={`text-xs ${active ? "text-pink-100" : "text-neutral-500"}`}>{nameOf(p)}</p>
                    <p className="text-4xl font-bold leading-tight mt-1">{p.credits}</p>
                    <p className={`text-xs ${active ? "text-pink-100" : "text-neutral-500"}`}>{p.credits === 1 ? "סרטון" : "סרטונים"}</p>
                    <p className="mt-3 flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl font-bold">{formatILS(p.price)}</span>
                      {p.originalPrice ? <span className={`text-sm line-through ${active ? "text-pink-200" : "text-neutral-400"}`}>{formatILS(p.originalPrice)}</span> : null}
                    </p>
                    <p className={`text-[11px] ${active ? "text-pink-100" : "text-neutral-500"}`}>{formatILS(p.perVideo)} {content.per_video_label}</p>
                  </button>
                );
              })}
            </div>
          )}
          {saving > 0 && (
            <div className="rounded-2xl bg-white border border-neutral-100 px-4 py-3 flex items-center gap-3 text-sm">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">✓</span>
              <span>{fillTemplate(content.savings_note, { saving: formatILS(saving) })}</span>
            </div>
          )}
          <p className="text-xs text-neutral-400">{content.price_note}</p>
        </section>

        {/* Trust */}
        <Card padding="md">
          <ul className="space-y-2.5 text-sm">
            {[content.trust_1, content.trust_2, content.trust_3].filter(Boolean).map((t, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0" aria-hidden="true">{i === 0 ? "🔒" : i === 1 ? "🛡️" : "🧾"}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500 mt-4 pt-3 border-t border-neutral-100 leading-relaxed">
            {content.policy_line}{" "}
            <Link href="/terms" className="text-pink-600 underline underline-offset-2">לתקנון</Link>
            {" · "}
            <Link href="/refunds" className="text-pink-600 underline underline-offset-2">מדיניות ביטולים</Link>
          </p>
        </Card>

        {/* What a video includes */}
        <Card padding="none">
          <button type="button" onClick={() => setIncludesOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3.5 text-right" aria-expanded={includesOpen}>
            <span className="font-semibold">{content.includes_title}</span>
            <span className={`text-neutral-400 transition-transform ${includesOpen ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {includesOpen && (
            <ul className="px-4 pb-4 space-y-1.5 text-sm text-neutral-700">
              {includes.map((line, i) => (
                <li key={i} className="flex gap-2"><span className="text-pink-500">•</span><span>{line}</span></li>
              ))}
            </ul>
          )}
        </Card>

        {/* Referral */}
        {showReferral && (
          <Card padding="md" className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center text-xl shrink-0" aria-hidden="true">🎁</span>
            <div>
              <p className="font-semibold">{content.referral_title}</p>
              <p className="text-sm text-neutral-600 mt-0.5">{content.referral_body}</p>
            </div>
          </Card>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section>
            <h2 className="font-bold text-lg mb-2">{content.faq_title}</h2>
            <Card padding="none">
              {faq.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={i} className={i > 0 ? "border-t border-neutral-100" : ""}>
                    <button type="button" onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-right" aria-expanded={open}>
                      <span className="font-semibold text-sm">{item.q}</span>
                      <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
                    </button>
                    {open && <p className="px-4 pb-4 text-sm text-neutral-600 whitespace-pre-line leading-relaxed">{item.a}</p>}
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        {/* Orders / movements */}
        <section>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1 mb-3">
            {(["orders", "movements"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-pink-500 text-white shadow-sm" : "text-neutral-500"}`}
              >
                {t === "orders" ? content.orders_title : content.movements_title}
                <span className="mr-1 text-xs opacity-80">{history ? (t === "orders" ? history.orders.length : history.movements.length) : ""}</span>
              </button>
            ))}
          </div>
          {!history ? (
            <p className="text-sm text-neutral-400">טוען...</p>
          ) : tab === "orders" ? (
            history.orders.length === 0 ? (
              <p className="text-sm text-neutral-500">{content.empty_orders}</p>
            ) : (
              <div className="space-y-2">
                {history.orders.map((o) => {
                  const st = orderStatus[o.status] || { label: o.status, cls: "text-neutral-500 bg-neutral-100" };
                  return (
                    <Card key={o.id} padding="sm">
                      <div className="flex items-center justify-between gap-3 px-1">
                        <div>
                          <p className="text-sm font-medium">{o.credits === 1 ? "סרטון אחד" : `${o.credits} סרטונים`} · {formatILS(o.amount)}</p>
                          <p className="text-[11px] text-neutral-400">{formatDateHe(o.created_at)}{o.payment_id ? ` · אסמכתה ${o.payment_id}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {o.status === "completed" && o.document_id && (
                            // The invoice-receipt SUMIT issued, served through our API (owner, 2026-11-23)
                            <a
                              href={`/api/payments/invoice/${o.id}`}
                              target="_blank"
                              rel="noopener"
                              className="text-[11px] font-bold text-pink-600 hover:underline"
                            >
                              📄 חשבונית
                            </a>
                          )}
                          <span className={`text-[11px] px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : history.movements.length === 0 ? (
            <p className="text-sm text-neutral-500">{content.empty_movements}</p>
          ) : (
            <div className="space-y-2">
              {history.movements.map((m, i) => (
                <Card key={i} padding="sm">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm">{m.text}</p>
                      <p className="text-[11px] text-neutral-400">{formatDateHe(m.at)}</p>
                    </div>
                    {m.delta !== null && (
                      <span className={`text-sm font-bold ${m.delta > 0 ? "text-emerald-600" : "text-neutral-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-neutral-400 text-center">{content.footer_note}</p>
      </div>

      {/* The CTA, above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            disabled={!offer}
            onClick={() => setPurchaseOpen(true)}
            className="w-full py-4 rounded-full bg-pink-500 text-white font-bold shadow-xl shadow-pink-500/30 active:bg-pink-600 disabled:opacity-60"
          >
            {!offer
              ? "…"
              : offer.enabled && chosen
                ? fillTemplate(content.cta, { label: chosen.label, price: formatILS(chosen.price) })
                : content.cta_contact}
          </button>
        </div>
      </div>

      <CreditsAccess
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        total={balance.total}
        used={balance.used}
        initialPackage={selected}
        showPageLink={false}
      />
    </main>
  );
}
