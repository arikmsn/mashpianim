import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal in-memory stand-in for the browser's sessionStorage
class FakeStorage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}
const storage = new FakeStorage();
(globalThis as unknown as { sessionStorage: FakeStorage }).sessionStorage = storage;

const cache = await import("../src/lib/client-cache.ts");
const { readCache, writeCache, clearCache, shouldResetCache, syncCacheOwner, CACHE_OWNER_KEY } = cache;

const USER_A = "aaaaaaaa-0000-0000-0000-000000000001";
const USER_B = "bbbbbbbb-0000-0000-0000-000000000002";

beforeEach(() => {
  clearCache();
  storage.clear();
});

describe("cache owner rules (QA-01)", () => {
  test("resets whenever the signed-in user differs from the cache owner", () => {
    assert.equal(shouldResetCache(USER_A, USER_B), true);
    assert.equal(shouldResetCache(USER_A, null), true);
    assert.equal(shouldResetCache(null, USER_A), true);
  });

  test("keeps the cache for the same user and for an anonymous visitor who stays anonymous", () => {
    assert.equal(shouldResetCache(USER_A, USER_A), false);
    assert.equal(shouldResetCache(null, null), false);
  });
});

describe("syncCacheOwner", () => {
  test("a different user logging in drops the previous user's responses", () => {
    syncCacheOwner(USER_A);
    writeCache("/api/profile", { user: { id: USER_A, type: "brand" } });
    assert.deepEqual(readCache("/api/profile"), { user: { id: USER_A, type: "brand" } });

    syncCacheOwner(USER_B);
    assert.equal(readCache("/api/profile"), undefined);
    assert.equal(storage.getItem(CACHE_OWNER_KEY), USER_B);
  });

  test("logout drops the cache and forgets the owner", () => {
    syncCacheOwner(USER_A);
    writeCache("/api/connections", { connections: [1] });
    syncCacheOwner(null);
    assert.equal(readCache("/api/connections"), undefined);
    assert.equal(storage.getItem(CACHE_OWNER_KEY), null);
  });

  test("the same user again (token refresh, reload) keeps the cache", () => {
    syncCacheOwner(USER_A);
    writeCache("/api/profile", { ok: 1 });
    syncCacheOwner(USER_A);
    assert.deepEqual(readCache("/api/profile"), { ok: 1 });
  });
});

describe("clearCache", () => {
  test("removes only the app's cache keys, optionally by prefix", () => {
    writeCache("/api/profile", 1);
    writeCache("/api/videos?portfolio=me", 2);
    storage.setItem("unrelated", "keep");
    clearCache("/api/videos");
    assert.equal(readCache("/api/videos?portfolio=me"), undefined);
    assert.equal(readCache("/api/profile"), 1);
    clearCache();
    assert.equal(readCache("/api/profile"), undefined);
    assert.equal(storage.getItem("unrelated"), "keep");
  });
});
