import { test, describe } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.ts";
import {
  DIGEST_SMS_MAX_CHARS,
  SMS_LINK_BRAND,
  SMS_LINK_CREATOR,
  brandDigestSms,
  creatorDigestSms,
  digestSmsEnabled,
  brandDigestDue,
  brandDigestText,
  brandDigestWorthSending,
  creatorDigestDue,
  creatorDigestText,
  digestMode,
  localParts,
  newHeartsFor,
} from "../src/lib/digests.ts";
import { bucketCounts, dailySeries, dayKey } from "../src/lib/messaging-stats.ts";

describe("WhatsApp digests (owner, 2026-11-16)", () => {
  test("the switch: off unless dry / on", () => {
    assert.equal(digestMode({}), "off");
    assert.equal(digestMode({ WHATSAPP_DIGESTS: "yes" }), "off");
    assert.equal(digestMode({ WHATSAPP_DIGESTS: "dry" }), "dry");
    assert.equal(digestMode({ WHATSAPP_DIGESTS: " ON " }), "on");
  });

  test("windows are read in Israel time: creators at 18:xx every day, businesses on Sunday 10:xx", () => {
    // 2026-11-16 is a Monday. 16:30 UTC = 18:30 Israel (UTC+2 in November)
    assert.equal(localParts(new Date("2026-11-16T16:30:00Z")).hour, 18);
    assert.equal(creatorDigestDue(new Date("2026-11-16T16:30:00Z")), true);
    assert.equal(creatorDigestDue(new Date("2026-11-16T17:00:00Z")), false, "19:00 Israel is past the window");
    assert.equal(creatorDigestDue(new Date("2026-11-16T15:59:00Z")), false);
    // Sunday 2026-11-15 10:15 Israel = 08:15 UTC
    assert.equal(brandDigestDue(new Date("2026-11-15T08:15:00Z")), true);
    assert.equal(brandDigestDue(new Date("2026-11-16T08:15:00Z")), false, "Monday");
    assert.equal(brandDigestDue(new Date("2026-11-15T09:15:00Z")), false, "11:15");
  });

  test("each heart is announced once", () => {
    const hearts = [
      { connectionId: "a", brandName: "A", productName: "p1", createdAt: "2026-11-15T10:00:00Z" },
      { connectionId: "b", brandName: "B", productName: "p2", createdAt: "2026-11-16T10:00:00Z" },
    ];
    assert.deepEqual(newHeartsFor(hearts, new Set(["a"])).map((h) => h.connectionId), ["b"]);
    assert.deepEqual(newHeartsFor(hearts, new Set()).map((h) => h.connectionId), ["a", "b"]);
    assert.deepEqual(newHeartsFor(hearts, new Set(["a", "b"])), []);
  });

  test("creator text: first name, count, newest first, capped at six lines, the link", () => {
    const one = creatorDigestText("דנה כהן", [{ connectionId: "a", brandName: "חנות הבית", productName: "קרם לחות", createdAt: "2026-11-16T10:00:00Z" }], "https://www.mashpian.online");
    assert.ok(one.startsWith("💗 היי דנה!\nעסק אחד סימן אותך במשפיען אונליין:\n• חנות הבית — \"קרם לחות\""));
    assert.ok(one.endsWith("https://www.mashpian.online/connections"));
    const many = creatorDigestText(null, Array.from({ length: 8 }, (_, i) => ({ connectionId: String(i), brandName: `B${i}`, productName: `P${i}`, createdAt: `2026-11-1${i}T10:00:00Z` })), "https://x");
    assert.ok(many.startsWith("💗 היי!\n8 עסקים סימנו אותך"));
    assert.ok(many.includes("• B7 — \"P7\"\n• B6"), "newest first");
    assert.ok(many.includes("• ועוד 2…"));
  });

  test("brand text and when it is worth sending", () => {
    const t = brandDigestText("סטודיו לוליפופ", { newHearts: 3, waitingMutual: 1, waitingTotal: 4 }, "https://x");
    assert.ok(t.startsWith("📊 *סיכום שבועי — סטודיו לוליפופ*\n💗 3 יוצרים סימנו את המוצרים שלכם השבוע\n🎉 מאטץ' אחד מחכה לאישורכם\n⏳ 4 לבבות עדיין בלי תשובה"));
    assert.ok(t.endsWith("https://x/brand/connections"));
    assert.equal(brandDigestWorthSending({ newHearts: 0, waitingMutual: 0, waitingTotal: 2 }), false, "old unanswered hearts alone are not news");
    assert.equal(brandDigestWorthSending({ newHearts: 0, waitingMutual: 1, waitingTotal: 1 }), true);
  });
});

describe("SMS digests for phones without a WhatsApp chat", () => {
  test("one segment each, numbers included", () => {
    for (const n of [1, 2, 9, 12, 99]) assert.ok(creatorDigestSms(n).length <= DIGEST_SMS_MAX_CHARS, `creator ${n}: ${creatorDigestSms(n).length}`);
    for (const n of [{ newHearts: 1, waitingMutual: 0, waitingTotal: 1 }, { newHearts: 12, waitingMutual: 3, waitingTotal: 15 }, { newHearts: 99, waitingMutual: 99, waitingTotal: 99 }]) {
      assert.ok(brandDigestSms(n).length <= DIGEST_SMS_MAX_CHARS, `brand: ${brandDigestSms(n).length}`);
    }
    assert.ok(creatorDigestSms(1).startsWith("משפיען: עסק אחד סימן אותך!"));
    assert.ok(creatorDigestSms(3).endsWith(SMS_LINK_CREATOR));
    assert.equal(brandDigestSms({ newHearts: 2, waitingMutual: 1, waitingTotal: 2 }), `משפיען: 2 יוצרים סימנו אתכם ומאטץ' אחד מחכה: ${SMS_LINK_BRAND}`);
    assert.equal(brandDigestSms({ newHearts: 1, waitingMutual: 12, waitingTotal: 1 }), `משפיען: יוצר/ת סימן/ה אתכם ו-12 מאטצ'ים מחכים: ${SMS_LINK_BRAND}`);
    assert.equal(brandDigestSms({ newHearts: 0, waitingMutual: 3, waitingTotal: 0 }), `משפיען: 3 מאטצ'ים מחכים: ${SMS_LINK_BRAND}`, "a match waiting with no new heart");
    assert.equal(brandDigestSms({ newHearts: 5, waitingMutual: 0, waitingTotal: 7 }), `משפיען: 5 יוצרים סימנו אתכם: ${SMS_LINK_BRAND}`);
    assert.equal(digestSmsEnabled({}), true);
    assert.equal(digestSmsEnabled({ DIGEST_SMS: "off" }), false);
  });

  test("the short links are redirects in next.config.ts", async () => {
    const rules = await (nextConfig.redirects as () => Promise<{ source: string; destination: string }[]>)();
    const map = new Map(rules.map((r) => [r.source, r.destination]));
    assert.equal(map.get("/" + SMS_LINK_CREATOR.split("/")[1]), "/connections");
    assert.equal(map.get("/" + SMS_LINK_BRAND.split("/")[1]), "/brand/connections");
  });
});

describe("message log counts (Israel days)", () => {
  const now = new Date("2026-11-16T20:30:00Z"); // 22:30 Israel, Monday
  const rows = [
    { channel: "sms", status: "sent", created_at: "2026-11-16T19:00:00Z" }, // today
    { channel: "sms", status: "sent", created_at: "2026-11-15T23:30:00Z" }, // 01:30 Israel on the 16th → today
    { channel: "sms", status: "failed", created_at: "2026-11-16T10:00:00Z" },
    { channel: "sms", status: "sent", created_at: "2026-11-12T10:00:00Z" }, // 4 days ago → week
    { channel: "sms", status: "sent", created_at: "2026-10-30T10:00:00Z" }, // 17 days ago → month
    { channel: "sms", status: "sent", created_at: "2026-10-01T10:00:00Z" }, // too old
    { channel: "whatsapp", status: "dry", created_at: "2026-11-16T16:10:00Z" }, // dry runs are not sends
    { channel: "whatsapp", status: "sent", created_at: "2026-11-16T16:12:00Z" },
  ];
  test("today / week / month per channel, failures apart, dry runs ignored", () => {
    const c = bucketCounts(rows, now);
    assert.deepEqual(c.sms, { today: 2, week: 3, month: 4, failed_month: 1 });
    assert.deepEqual(c.whatsapp, { today: 1, week: 1, month: 1, failed_month: 0 });
  });
  test("day keys and the daily series", () => {
    assert.equal(dayKey("2026-11-15T23:30:00Z"), "2026-11-16");
    const series = dailySeries(rows, 3, now);
    assert.deepEqual(series.map((d) => d.date), ["2026-11-16", "2026-11-15", "2026-11-14"]);
    assert.deepEqual(series[0], { date: "2026-11-16", sms: 2, whatsapp: 1, failed: 1, dry: 1 });
  });
});
