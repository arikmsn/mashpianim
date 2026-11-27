import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_NUDGE_STATE,
  NUDGE_GAP,
  NUDGE_MAX_DISMISSALS,
  dismissNudge,
  hasSocialHandle,
  parseNudgeState,
  recordVisit,
  shouldShowSocialNudge,
} from "../src/lib/social-nudge.ts";

const show = (state = INITIAL_NUDGE_STATE, hasHandle = false, portfolioComplete = true) => shouldShowSocialNudge({ state, hasHandle, portfolioComplete });

test("hasSocialHandle: either handle counts, a bare @ or spaces do not", () => {
  assert.equal(hasSocialHandle({ tiktok_handle: "@me" }), true);
  assert.equal(hasSocialHandle({ instagram_handle: "me" }), true);
  assert.equal(hasSocialHandle({ tiktok_handle: "@", instagram_handle: "  " }), false);
  assert.equal(hasSocialHandle({ tiktok_handle: null }), false);
  assert.equal(hasSocialHandle(null), false);
});

test("never on the first visit, shows from the second", () => {
  let s = recordVisit(INITIAL_NUDGE_STATE);
  assert.equal(show(s), false);
  s = recordVisit(s);
  assert.equal(show(s), true);
});

test("not when a handle is filled or the portfolio is still missing", () => {
  const s = recordVisit(recordVisit(INITIAL_NUDGE_STATE));
  assert.equal(show(s, true), false);
  assert.equal(show(s, false, false), false);
});

test("a dismissal waits a few visits, and it stops for good after the max", () => {
  let s = recordVisit(recordVisit(INITIAL_NUDGE_STATE));
  for (let d = 0; d < NUDGE_MAX_DISMISSALS; d++) {
    assert.equal(show(s), true, `before dismissal ${d + 1}`);
    s = dismissNudge(s);
    assert.equal(show(s), false, "hidden right after the dismissal");
    for (let i = 1; i < NUDGE_GAP; i++) {
      s = recordVisit(s);
      assert.equal(show(s), false, `still hidden ${i} visits later`);
    }
    s = recordVisit(s);
  }
  assert.equal(show(s), false, "no more after the max");
});

test("parseNudgeState survives junk", () => {
  assert.deepEqual(parseNudgeState(null), INITIAL_NUDGE_STATE);
  assert.deepEqual(parseNudgeState("not json"), INITIAL_NUDGE_STATE);
  assert.deepEqual(parseNudgeState('{"visits":-3,"dismissals":"x"}'), INITIAL_NUDGE_STATE);
  assert.deepEqual(parseNudgeState('{"visits":4,"dismissals":1,"nextAt":7}'), { visits: 4, dismissals: 1, nextAt: 7 });
});
