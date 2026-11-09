import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { brandTask, brandBoardTab, boardTabFromParam, BRAND_BOARD_TABS } from "../src/lib/connection-flow.ts";
import { canUploadConnectionVideo } from "../src/lib/authz.ts";
import { MAX_DELIVERABLES_PER_ROUND } from "../src/lib/chat.ts";

describe("the business's board (owner, 2026-11-09)", () => {
  test("a task exists only when the next step is the business's own", () => {
    // Hearts: a creator's heart is an inbox item, not a task; a match waits for the business
    assert.equal(brandTask({ status: "pending", mutual_at: null }), null);
    assert.equal(brandTask({ status: "pending", mutual_at: "2026-11-09T10:00:00Z" })?.kind, "confirm_match");
    // Approved: the brief first, then the creator's approval (not ours), then shipping
    assert.equal(brandTask({ status: "approved", brief_posted_at: null })?.kind, "post_brief");
    assert.equal(brandTask({ status: "approved", brief_posted_at: "x", brief_approved_at: null }), null);
    assert.equal(brandTask({ status: "approved", brief_posted_at: "x", brief_approved_at: "y" })?.kind, "ship");
    assert.match(brandTask({ status: "approved", brief_posted_at: "x", brief_approved_at: "y", product_type: "digital" })!.label, /גישה/);
    // The creator's turn: nothing to do
    for (const s of ["shipped", "delivered", "filming", "revision_requested"]) assert.equal(brandTask({ status: s }), null, s);
    // Review
    assert.equal(brandTask({ status: "uploaded" })?.kind, "review");
    assert.equal(brandTask({ status: "in_review" })?.kind, "review");
    // Closed
    for (const s of ["completed", "cancelled", "rejected"]) assert.equal(brandTask({ status: s }), null, s);
    // Matches come first, then shipping, then briefs, then reviews
    const order = ["confirm_match", "ship", "post_brief", "review"].map((k) =>
      k === "confirm_match" ? brandTask({ status: "pending", mutual_at: "x" })!.order
        : k === "ship" ? brandTask({ status: "approved", brief_posted_at: "x", brief_approved_at: "y" })!.order
        : k === "post_brief" ? brandTask({ status: "approved" })!.order
        : brandTask({ status: "uploaded" })!.order
    );
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });

  test("every connection has one state view; hearts of all kinds share the inbox", () => {
    assert.equal(brandBoardTab({ status: "pending", initiated_by: "creator" }), "hearts");
    assert.equal(brandBoardTab({ status: "pending", initiated_by: "brand" }), "hearts");
    assert.equal(brandBoardTab({ status: "pending", initiated_by: "creator", mutual_at: "x" }), "hearts");
    for (const s of ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"]) assert.equal(brandBoardTab({ status: s }), "active", s);
    for (const s of ["completed", "cancelled", "rejected"]) assert.equal(brandBoardTab({ status: s }), "done", s);
    assert.deepEqual(BRAND_BOARD_TABS.map((t) => t.id), ["tasks", "active", "hearts", "done"]);
  });

  test("old deep links still land on a view", () => {
    assert.equal(boardTabFromParam("match"), "tasks");
    assert.equal(boardTabFromParam("chose_you"), "hearts");
    assert.equal(boardTabFromParam("my_list"), "hearts");
    assert.equal(boardTabFromParam("active"), "active");
    assert.equal(boardTabFromParam("done"), "done");
    assert.equal(boardTabFromParam("tasks"), "tasks");
    assert.equal(boardTabFromParam("nonsense"), null);
    assert.equal(boardTabFromParam(null), null);
  });
});

describe("several deliverables per round (owner, 2026-11-09)", () => {
  test("uploads stay open while the round is in front of the brand", () => {
    for (const s of ["delivered", "filming", "revision_requested", "uploaded", "in_review"]) assert.equal(canUploadConnectionVideo(s), true, s);
    for (const s of ["pending", "approved", "shipped", "completed", "cancelled", "rejected"]) assert.equal(canUploadConnectionVideo(s), false, s);
    assert.equal(MAX_DELIVERABLES_PER_ROUND, 5);
  });
});
