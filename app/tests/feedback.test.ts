import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateFeedback, isFeedbackStatus, FEEDBACK_KINDS, SUBJECT_MAX, MESSAGE_MAX } from "../src/lib/feedback.ts";

describe("feedback validation", () => {
  test("accepts a trimmed, well-formed report", () => {
    const r = validateFeedback({ kind: "bug", subject: "  הכפתור לא עובד ", message: "  בלחיצה על אישור לא קורה כלום  ", page: "/feed" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.value, { kind: "bug", subject: "הכפתור לא עובד", message: "בלחיצה על אישור לא קורה כלום", page: "/feed" });
    }
  });

  test("rejects unknown kinds and short or oversized text", () => {
    assert.equal(validateFeedback({ kind: "spam", subject: "x y", message: "hello there" }).ok, false);
    assert.equal(validateFeedback({ kind: "bug", subject: "x", message: "hello there" }).ok, false);
    assert.equal(validateFeedback({ kind: "bug", subject: "ok", message: "hi" }).ok, false);
    assert.equal(validateFeedback({ kind: "bug", subject: "a".repeat(SUBJECT_MAX + 1), message: "hello there" }).ok, false);
    assert.equal(validateFeedback({ kind: "bug", subject: "ok", message: "a".repeat(MESSAGE_MAX + 1) }).ok, false);
    assert.equal(validateFeedback(null).ok, false);
  });

  test("page is optional and bounded; statuses are a closed set", () => {
    const r = validateFeedback({ kind: "contact", subject: "שאלה", message: "איך מקבלים קרדיטים?" });
    assert.equal(r.ok && r.value.page, null);
    assert.equal(FEEDBACK_KINDS.length, 3);
    assert.equal(isFeedbackStatus("in_progress"), true);
    assert.equal(isFeedbackStatus("done"), false);
  });
});
