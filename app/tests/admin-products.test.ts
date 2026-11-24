import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAdminProductFilter, matchesProductSearch, pickAdminProductUpdates, productStatusLabel, productTypeLabel, summarizeProductConnections } from "../src/lib/admin-products.ts";
import { formatDateTimeHe } from "../src/lib/dates.ts";
import { loginLabel, recordLogin } from "../src/lib/login-record.ts";

describe("admin products (owner, 2026-11-24)", () => {
  test("the editor's updates: the business's fields, status only active / paused, no ownership or legacy link", () => {
    const u = pickAdminProductUpdates({ name: "  שרשרת  ", price: "99", status: "deleted", source_url: "https://x", brand_id: "nope", category: "אופנה", category_custom: "", max_creators: "3" });
    assert.deepEqual(u, { name: "שרשרת", price: 99, category: "אופנה", category_custom: null, max_creators: 3 });
    assert.deepEqual(pickAdminProductUpdates({ status: "paused" }), { status: "paused" });
    assert.deepEqual(pickAdminProductUpdates({ status: "active", product_type: "digital" }), { status: "active", product_type: "digital" });
    assert.deepEqual(pickAdminProductUpdates(null), {});
    assert.deepEqual(pickAdminProductUpdates({ category: "לא קטגוריה" }), {}, "an unknown category is dropped, not saved");
  });

  test("a product's connection summary: waiting hearts, matches, completed, closed", () => {
    const s = summarizeProductConnections([
      { status: "pending" },
      { status: "pending", mutual_at: "2026-11-20" },
      { status: "approved" },
      { status: "filming" },
      { status: "completed" },
      { status: "cancelled" },
      { status: "rejected" },
      { status: null },
    ]);
    assert.deepEqual(s, { waiting: 2, matched: 3, completed: 1, closed: 2 });
    assert.deepEqual(summarizeProductConnections([]), { waiting: 0, matched: 0, completed: 0, closed: 0 });
  });

  test("filters, labels and the search", () => {
    assert.ok(isAdminProductFilter("paused") && isAdminProductFilter("all") && !isAdminProductFilter("x"));
    assert.equal(productStatusLabel("active"), "פעיל");
    assert.equal(productStatusLabel("deleted"), "הוסר");
    assert.equal(productTypeLabel("digital"), "דיגיטלי");
    assert.equal(productTypeLabel(null), "פיזי");
    const row = { name: "שרשרת לגבר", shop_name: "מותג האופנה", phone: "+972501234567" };
    assert.ok(matchesProductSearch(row, "שרשרת") && matchesProductSearch(row, "מותג") && matchesProductSearch(row, "0501234") && matchesProductSearch(row, ""));
    assert.ok(!matchesProductSearch(row, "נעליים"));
  });
});

describe("login timestamps (migration 027)", () => {
  test("the label is Israel time, day first", () => {
    assert.equal(formatDateTimeHe("2026-11-23T22:05:00Z"), "24.11.2026, 00:05");
    assert.equal(loginLabel("2026-07-01T09:30:00Z"), "01.07.2026, 12:30", "summer time");
    assert.equal(loginLabel(null), "");
    assert.equal(loginLabel("nope"), "");
  });

  test("recordLogin shifts the last login into the previous one and never throws", async () => {
    const calls: Record<string, unknown>[] = [];
    const fake = {
      from() {
        return {
          select() {
            return { eq() { return { maybeSingle: async () => ({ data: { last_login_at: "2026-11-20T10:00:00Z" }, error: null }) }; } };
          },
          update(values: Record<string, unknown>) {
            calls.push(values);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = await recordLogin(fake as any, "u1", new Date("2026-11-24T00:05:00Z"));
    assert.equal(ok, true);
    assert.deepEqual(calls, [{ previous_login_at: "2026-11-20T10:00:00Z", last_login_at: "2026-11-24T00:05:00.000Z" }]);
    const broken = { from() { throw new Error("no columns"); } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(await recordLogin(broken as any, "u1"), false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(await recordLogin(fake as any, null), false);
  });
});
