import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedRegistrationType,
  pickAllowedFields,
  USER_EDITABLE_FIELDS,
  CREATOR_EDITABLE_FIELDS,
  BRAND_EDITABLE_FIELDS,
  participantRole,
  isConnectionParticipant,
  toPublicProduct,
  devLoginEnabled,
  resolveDevRole,
} from "../src/lib/authz.ts";

describe("SEC-01 registration role whitelist", () => {
  test("accepts only creator and brand", () => {
    assert.equal(isAllowedRegistrationType("creator"), true);
    assert.equal(isAllowedRegistrationType("brand"), true);
  });

  test("rejects admin and anything else", () => {
    for (const bad of ["admin", "Admin", "ADMIN", "", " creator", null, undefined, 1, {}, ["creator"]]) {
      assert.equal(isAllowedRegistrationType(bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe("SEC-02 profile field allowlists", () => {
  test("user fields: only full_name survives; role/activation/phone are dropped", () => {
    const out = pickAllowedFields(
      { full_name: "דנה", type: "admin", is_active: false, phone: "+972500000000", auth_user_id: "x", id: "y", email: "a@b.c" },
      USER_EDITABLE_FIELDS
    );
    assert.deepEqual(out, { full_name: "דנה" });
  });

  test("creator fields: privileged counters are dropped, legitimate edits kept, numbers normalised", () => {
    const out = pickAllowedFields(
      {
        bio: "שלום",
        city: "תל אביב",
        categories: ["אופנה", 42, "  ביוטי ", ""],
        tiktok_handle: "@dana",
        tiktok_followers: "12000",
        instagram_followers: -5,
        level: "on_the_radar",
        hearts: 999,
        completed_connections: 50,
        user_id: "other",
        id: "other",
      },
      CREATOR_EDITABLE_FIELDS
    );
    assert.deepEqual(out, {
      bio: "שלום",
      city: "תל אביב",
      categories: ["אופנה", "ביוטי"],
      tiktok_handle: "@dana",
      tiktok_followers: 12000,
      instagram_followers: 0,
    });
    assert.equal("level" in out, false);
    assert.equal("hearts" in out, false);
    assert.equal("completed_connections" in out, false);
  });

  test("brand fields: credits and usage counters are dropped", () => {
    const out = pickAllowedFields(
      { shop_name: "חנות", categories: ["אופנה"], total_credits: 9999, used_credits: 0, user_id: "other", website_url: null },
      BRAND_EDITABLE_FIELDS
    );
    assert.deepEqual(out, { shop_name: "חנות", categories: ["אופנה"], website_url: null });
  });

  test("non-object input yields nothing", () => {
    assert.deepEqual(pickAllowedFields(null, USER_EDITABLE_FIELDS), {});
    assert.deepEqual(pickAllowedFields("full_name", USER_EDITABLE_FIELDS), {});
    assert.deepEqual(pickAllowedFields(["full_name"], USER_EDITABLE_FIELDS), {});
  });

  test("prototype keys are not treated as own fields", () => {
    const out = pickAllowedFields(Object.create({ full_name: "inherited" }), USER_EDITABLE_FIELDS);
    assert.deepEqual(out, {});
  });
});

describe("SEC-05 / SEC-06 connection participation", () => {
  const conn = { creatorUserId: "creator-1", brandUserId: "brand-1" };

  test("creator and brand of the connection are participants with their role", () => {
    assert.equal(participantRole(conn, "creator-1"), "creator");
    assert.equal(participantRole(conn, "brand-1"), "brand");
    assert.equal(isConnectionParticipant(conn, "creator-1"), true);
  });

  test("anyone else is not a participant", () => {
    assert.equal(participantRole(conn, "someone-else"), null);
    assert.equal(isConnectionParticipant(conn, "someone-else"), false);
    assert.equal(isConnectionParticipant(conn, null), false);
    assert.equal(isConnectionParticipant(conn, undefined), false);
    assert.equal(isConnectionParticipant(conn, ""), false);
  });

  test("missing party ids never match", () => {
    assert.equal(isConnectionParticipant({ creatorUserId: null, brandUserId: undefined }, "creator-1"), false);
    assert.equal(isConnectionParticipant({}, "x"), false);
  });
});

describe("SEC-08 public product projection", () => {
  const full = {
    id: "p1",
    name: "קרם",
    description: "תיאור",
    price: 120,
    image_url: "https://x/img.jpg",
    shipping_policy: "free",
    shipping_address: "רחוב סודי 1",
    source_url: "https://shop",
    status: "active",
    product_type: "digital",
    digital_access_type: "code",
    digital_access_instructions: "הקוד הוא 1234",
    digital_access_duration_days: 30,
    expiration_date: null,
    quantity: 5,
    max_creators: 3,
    created_at: "2026-11-02",
    brand_id: "bp-1",
    brand_name: "המותג",
    brand_user_id: "u-brand",
    category: "ביוטי",
    categories: ["ביוטי"],
    logo_url: null,
    brand_profiles: { user_id: "u-brand" },
  };

  test("private and internal fields are removed", () => {
    const pub = toPublicProduct(full);
    for (const key of ["shipping_address", "digital_access_instructions", "brand_id", "brand_profiles"]) {
      assert.equal(key in pub, false, `${key} must not be public`);
    }
  });

  test("fields the feed and profile modal need are kept", () => {
    const pub = toPublicProduct(full);
    for (const key of ["id", "name", "description", "price", "image_url", "product_type", "brand_name", "brand_user_id", "categories", "logo_url", "max_creators", "status"]) {
      assert.equal(key in pub, true, `${key} must stay public`);
    }
    assert.equal(pub.price, 120);
  });
});

describe("SEC-04 dev login availability", () => {
  test("never available on a Vercel production deployment", () => {
    assert.equal(devLoginEnabled({ VERCEL_ENV: "production", NODE_ENV: "production" }), false);
    assert.equal(devLoginEnabled({ VERCEL_ENV: "production", NODE_ENV: "production", ALLOW_DEV_LOGIN: "true" }), false);
    assert.equal(devLoginEnabled({ VERCEL_ENV: "production", NODE_ENV: "development" }), false);
  });

  test("production builds elsewhere require an explicit opt-in", () => {
    assert.equal(devLoginEnabled({ NODE_ENV: "production" }), false);
    assert.equal(devLoginEnabled({ VERCEL_ENV: "preview", NODE_ENV: "production" }), false);
    assert.equal(devLoginEnabled({ VERCEL_ENV: "preview", NODE_ENV: "production", ALLOW_DEV_LOGIN: "true" }), true);
    assert.equal(devLoginEnabled({ NODE_ENV: "production", ALLOW_DEV_LOGIN: "yes" }), false);
  });

  test("local development is allowed", () => {
    assert.equal(devLoginEnabled({ NODE_ENV: "development" }), true);
    assert.equal(devLoginEnabled({}), true);
  });
});

describe("SEC-04 dev login role resolution", () => {
  const config = { creator: { redirect: "/feed" }, brand: { redirect: "/brand" } };

  test("designated roles resolve", () => {
    assert.deepEqual(resolveDevRole("creator", config), { redirect: "/feed" });
    assert.deepEqual(resolveDevRole("brand", config), { redirect: "/brand" });
  });

  test("admin, unknown and prototype keys never resolve", () => {
    for (const bad of ["admin", "Creator", "", "__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      assert.equal(resolveDevRole(bad, config), null, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test("non-string roles never resolve", () => {
    for (const bad of [null, undefined, 1, {}, ["creator"], { toString: () => "creator" }]) {
      assert.equal(resolveDevRole(bad, config), null, `should reject ${JSON.stringify(bad)}`);
    }
  });
});
