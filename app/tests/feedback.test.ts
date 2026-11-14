import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateFeedback, isFeedbackStatus, FEEDBACK_KINDS, SUBJECT_MAX, MESSAGE_MAX, validateReplyText, statusAfterReply, buildThread, isThreadsNotReadyError, REPLY_MAX } from "../src/lib/feedback.ts";

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

describe("feedback threads (owner list 2026-11-14, item 6)", () => {
  test("a reply is trimmed, non-empty and bounded", () => {
    assert.deepEqual(validateReplyText("  תודה, נבדוק  "), { ok: true, text: "תודה, נבדוק" });
    assert.equal(validateReplyText("   ").ok, false);
    assert.equal(validateReplyText(undefined).ok, false);
    assert.equal(validateReplyText("x".repeat(REPLY_MAX + 1)).ok, false);
  });

  test("where a reply moves the report", () => {
    assert.equal(statusAfterReply("new", "admin"), "in_progress");
    assert.equal(statusAfterReply("closed", "admin"), "in_progress");
    assert.equal(statusAfterReply("in_progress", "admin"), "in_progress");
    assert.equal(statusAfterReply("closed", "user"), "new");
    assert.equal(statusAfterReply("in_progress", "user"), "in_progress");
    assert.equal(statusAfterReply("new", "user"), "new");
  });

  test("the thread opens with the report, replies follow in time order, a legacy note stands in for a missing reply", () => {
    const fb = { message: "הכפתור לא עובד", created_at: "2026-11-14T10:00:00Z", admin_note: "תיקנו", updated_at: "2026-11-14T12:00:00Z" };
    const legacy = buildThread(fb, []);
    assert.deepEqual(legacy.map((m) => [m.id, m.from_admin, m.text]), [["report", false, "הכפתור לא עובד"], ["legacy-note", true, "תיקנו"]]);
    const replies = [
      { id: "b", from_admin: false, text: "עדיין לא", created_at: "2026-11-14T13:00:00Z" },
      { id: "a", from_admin: true, text: "בודקים", created_at: "2026-11-14T11:00:00Z" },
    ];
    const real = buildThread(fb, replies);
    assert.deepEqual(real.map((m) => m.id), ["report", "a", "b"], "a real reply from us hides the legacy note");
    assert.deepEqual(buildThread({ message: "m", created_at: "2026-11-14T10:00:00Z", admin_note: null }, []).map((m) => m.id), ["report"]);
  });

  test("the 'migration 020 not yet applied' answers are recognised", () => {
    assert.equal(isThreadsNotReadyError({ code: "42P01", message: "relation \"public.feedback_messages\" does not exist" }), true);
    assert.equal(isThreadsNotReadyError({ code: "PGRST205", message: "Could not find the table 'public.feedback_messages' in the schema cache" }), true);
    assert.equal(isThreadsNotReadyError({ code: "PGRST204", message: "Could not find the 'last_message_at' column of 'feedback' in the schema cache" }), true);
    assert.equal(isThreadsNotReadyError({ code: "23505", message: "duplicate key" }), false);
    assert.equal(isThreadsNotReadyError(null), false);
  });
});
