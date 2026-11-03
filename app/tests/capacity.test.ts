import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { capacityStatus, formatBytes, PLAN_LIMITS } from "../src/lib/capacity.ts";

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("Supabase capacity watch", () => {
  test("bytes read as KB / MB / GB", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(29 * MB), "29 MB");
    assert.equal(formatBytes(1.5 * GB), "1.5 GB");
    assert.equal(formatBytes(12 * GB), "12 GB");
    assert.equal(formatBytes(-5), "0 B");
  });

  test("today's usage on the free plan is fine and says nothing", () => {
    const s = capacityStatus({ db_bytes: 13 * MB, storage_bytes: 29 * MB }, "free");
    assert.equal(s.level, "ok");
    assert.equal(s.message, null);
    assert.equal(s.storage.limit, PLAN_LIMITS.free.storageBytes);
  });

  test("70% of storage warns, 90% is critical, and the message names the numbers", () => {
    const warn = capacityStatus({ db_bytes: 20 * MB, storage_bytes: 0.72 * GB }, "free");
    assert.equal(warn.level, "warn");
    assert.match(warn.message || "", /אחסון הקבצים ב-72%/);
    assert.match(warn.message || "", /בימים הקרובים/);

    const critical = capacityStatus({ db_bytes: 20 * MB, storage_bytes: 0.95 * GB }, "free");
    assert.equal(critical.level, "critical");
    assert.match(critical.message || "", /עכשיו/);
  });

  test("the database gauge counts too, and the worst gauge sets the level", () => {
    const s = capacityStatus({ db_bytes: 480 * MB, storage_bytes: 100 * MB }, "free");
    assert.equal(s.db.level, "critical");
    assert.equal(s.storage.level, "ok");
    assert.equal(s.level, "critical");
    assert.match(s.message || "", /מסד הנתונים ב-96%/);
  });

  test("the same usage is comfortable on Pro", () => {
    const s = capacityStatus({ db_bytes: 480 * MB, storage_bytes: 0.95 * GB }, "pro");
    assert.equal(s.level, "ok");
    assert.equal(s.planLabel, "Pro");
  });
});
