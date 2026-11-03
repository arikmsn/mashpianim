import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FLOW_STEPS, flowStepIndex, flowNextAction, activeDeadlineField } from "../src/lib/connection-flow.ts";
import { FORMAT_LINES } from "../src/lib/brief.ts";

describe("journey timeline", () => {
  test("five milestones, statuses map onto them in order", () => {
    assert.equal(FLOW_STEPS.length, 5);
    assert.equal(flowStepIndex("pending"), -1);
    assert.equal(flowStepIndex("approved"), 0);
    assert.equal(flowStepIndex("shipped"), 1);
    assert.equal(flowStepIndex("delivered"), 2);
    assert.equal(flowStepIndex("filming"), 2);
    assert.equal(flowStepIndex("uploaded"), 3);
    assert.equal(flowStepIndex("in_review"), 3);
    assert.equal(flowStepIndex("revision_requested"), 3);
    assert.equal(flowStepIndex("completed"), 4);
    assert.equal(flowStepIndex("cancelled"), -1);
    assert.equal(flowStepIndex(null), -1);
  });

  test("each side is told what to do next, and who has to act", () => {
    assert.equal(flowNextAction("approved", "brand").mine, true);
    assert.equal(flowNextAction("approved", "creator").mine, false);
    assert.equal(flowNextAction("shipped", "creator").mine, true);
    assert.equal(flowNextAction("delivered", "creator").mine, true);
    assert.equal(flowNextAction("uploaded", "brand").mine, true);
    assert.equal(flowNextAction("uploaded", "creator").mine, false);
    assert.equal(flowNextAction("revision_requested", "creator").mine, true);
    assert.equal(flowNextAction("completed", "creator").mine, false);
    assert.equal(flowNextAction("nonsense", "creator").text, "");
  });

  test("pending hearts depend on who sent them", () => {
    assert.equal(flowNextAction("pending", "creator", { initiatedBy: "brand" }).mine, true);
    assert.equal(flowNextAction("pending", "creator", { initiatedBy: "creator" }).mine, false);
    assert.equal(flowNextAction("pending", "brand", { initiatedBy: "creator" }).mine, true);
  });

  test("digital products talk about access, not parcels", () => {
    assert.match(flowNextAction("approved", "brand", { deliveryType: "digital" }).text, /גישה/);
    assert.match(flowNextAction("shipped", "creator", { deliveryType: "digital" }).text, /גישה/);
    assert.match(flowNextAction("approved", "brand", { deliveryType: "physical" }).text, /מעקב/);
  });

  test("the running deadline follows the step", () => {
    assert.equal(activeDeadlineField("approved"), "ship_deadline");
    assert.equal(activeDeadlineField("shipped"), "deliver_deadline");
    assert.equal(activeDeadlineField("delivered"), "film_deadline");
    assert.equal(activeDeadlineField("revision_requested"), "film_deadline");
    assert.equal(activeDeadlineField("uploaded"), "review_deadline");
    assert.equal(activeDeadlineField("completed"), null);
    assert.equal(activeDeadlineField("pending"), null);
  });

  test("format lines shown on the product page are the ones sent in the brief", () => {
    assert.equal(FORMAT_LINES.length, 3);
    assert.match(FORMAT_LINES[0], /9:16/);
  });
});
