import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { notificationHref } from "../src/lib/notification-links.ts";

describe("notification deep links", () => {
  const data = { connectionId: "c1", productId: "p1" };

  test("creators land on the product page, or the highlighted connection card for older rows", () => {
    assert.equal(notificationHref({ type: "heart_received", data }, "creator"), "/products/p1");
    assert.equal(notificationHref({ type: "product_shipped", data: { connectionId: "c1" } }, "creator"), "/connections?open=c1");
    assert.equal(notificationHref({ type: "revision_requested", data }, "creator"), "/products/p1");
  });

  test("brands land on the highlighted connection card (modal)", () => {
    assert.equal(notificationHref({ type: "heart_received", data }, "brand"), "/brand/connections?open=c1");
    assert.equal(notificationHref({ type: "video_uploaded", data: { connectionId: "c1" } }, "brand"), "/brand/connections?open=c1");
  });

  test("a match opens the chat for both sides", () => {
    assert.equal(notificationHref({ type: "match", data }, "creator"), "/messages?connection=c1");
    assert.equal(notificationHref({ type: "match", data }, "brand"), "/messages?connection=c1");
    assert.equal(notificationHref({ type: "match", data: null }, "brand"), "/messages");
  });

  test("in-app reports: admins go to the feedback screen, reporters to their profile", () => {
    assert.equal(notificationHref({ type: "feedback_received", data: { feedbackId: "f" } }, "admin"), "/admin/feedback");
    assert.equal(notificationHref({ type: "feedback_received", data: { feedbackId: "f" } }, "creator"), null);
    assert.equal(notificationHref({ type: "feedback_updated", data: { feedbackId: "f" } }, "brand"), "/profile");
  });

  test("portfolio takedown goes to the profile; unknown or data-less rows have no link", () => {
    assert.equal(notificationHref({ type: "portfolio_video_removed", data: { videoId: "v" } }, "creator"), "/profile");
    assert.equal(notificationHref({ type: "system", data: null }, "creator"), null);
    assert.equal(notificationHref({ type: "heart_received", data: { connectionId: 5 } }, "brand"), null);
    assert.equal(notificationHref({ type: "heart_received", data }, null), null);
  });
});
