import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { notificationHref } from "../src/lib/notification-links.ts";
import { CHAT_NOTIFICATION_TYPES } from "../src/lib/chat.ts";

describe("notification deep links", () => {
  const data = { connectionId: "c1", productId: "p1" };

  test("hearts: creators land on the product page, or the highlighted connection card for older rows", () => {
    assert.equal(notificationHref({ type: "heart_received", data }, "creator"), "/products/p1");
    assert.equal(notificationHref({ type: "heart_back", data: { connectionId: "c1" } }, "creator"), "/connections?open=c1");
    assert.equal(notificationHref({ type: "heart_expired", data }, "creator"), "/products/p1");
  });

  test("hearts: brands land on the highlighted connection card (modal)", () => {
    assert.equal(notificationHref({ type: "heart_received", data }, "brand"), "/brand/connections?open=c1");
    assert.equal(notificationHref({ type: "match_ready", data: { connectionId: "c1" } }, "brand"), "/brand/connections?open=c1");
  });

  test("everything after the match opens the chat for both sides", () => {
    for (const type of ["match", "brief_posted", "brief_updated", "brief_approved", "product_shipped", "product_delivered", "video_uploaded", "revision_requested", "connection_completed", "filming_deadline_warning"]) {
      assert.equal(CHAT_NOTIFICATION_TYPES.has(type), true, type);
      assert.equal(notificationHref({ type, data }, "creator"), "/messages?connection=c1", type);
      assert.equal(notificationHref({ type, data }, "brand"), "/messages?connection=c1", type);
    }
    assert.equal(notificationHref({ type: "match", data: null }, "brand"), "/messages");
    // hearts stay out of the chat
    assert.equal(CHAT_NOTIFICATION_TYPES.has("heart_received"), false);
    assert.equal(CHAT_NOTIFICATION_TYPES.has("heart_back"), false);
  });

  test("an admin acting as a creator never lands in the admin area for connection events", () => {
    assert.equal(notificationHref({ type: "heart_received", data }, "creator", true), "/products/p1");
    assert.equal(notificationHref({ type: "heart_received", data }, "brand", true), "/brand/connections?open=c1");
    assert.equal(notificationHref({ type: "match", data }, "creator", true), "/messages?connection=c1");
  });

  test("in-app reports: only admins go to the feedback screen, reporters to their profile", () => {
    assert.equal(notificationHref({ type: "feedback_received", data: { feedbackId: "f" } }, "creator", true), "/admin/feedback");
    assert.equal(notificationHref({ type: "feedback_received", data: { feedbackId: "f" } }, "creator", false), null);
    assert.equal(notificationHref({ type: "feedback_updated", data: { feedbackId: "f" } }, "brand"), "/profile");
    // Capacity alerts (daily cron) lead admins to the dashboard gauge and nobody else anywhere
    assert.equal(notificationHref({ type: "capacity_warning", data: { role: "admin" } }, "creator", true), "/admin");
    assert.equal(notificationHref({ type: "capacity_warning", data: { role: "admin" } }, "creator", false), null);
  });

  test("portfolio takedown goes to the profile; unknown or data-less rows have no link", () => {
    assert.equal(notificationHref({ type: "portfolio_video_removed", data: { videoId: "v" } }, "creator"), "/profile");
    assert.equal(notificationHref({ type: "system", data: null }, "creator"), null);
    assert.equal(notificationHref({ type: "heart_received", data: { connectionId: 5 } }, "brand"), null);
    assert.equal(notificationHref({ type: "heart_received", data }, null), null);
  });
});
