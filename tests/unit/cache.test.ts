import { describe, expect, test } from "bun:test";
import { cached, invalidateNamespace, cacheStats } from "@/lib/cache";

describe("cached()", () => {
  test("returns the cached value without re-invoking the fetcher within TTL", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { n: calls };
    };
    const a = await cached("t1", "k1", 60_000, fetcher);
    const b = await cached("t1", "k1", 60_000, fetcher);
    expect(calls).toBe(1);
    expect(b).toEqual(a);
  });

  test("re-fetches after TTL expiry", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return calls;
    };
    await cached("t2", "k", 20, fetcher);
    await new Promise((r) => setTimeout(r, 45));
    const v = await cached("t2", "k", 20, fetcher);
    expect(v).toBe(2);
  });

  test("separate namespaces/keys do not collide", async () => {
    const x = await cached("t3", "a", 60_000, async () => "A");
    const y = await cached("t3", "b", 60_000, async () => "B");
    const z = await cached("t4", "a", 60_000, async () => "C");
    expect([x, y, z]).toEqual(["A", "B", "C"]);
  });

  test("fetcher failure is not cached — next call retries", async () => {
    let fail = true;
    const fetcher = async () => {
      if (fail) throw new Error("upstream down");
      return "recovered";
    };
    await expect(cached("t5", "k", 60_000, fetcher)).rejects.toThrow("upstream down");
    fail = false;
    const v = await cached("t5", "k", 60_000, fetcher);
    expect(v).toBe("recovered");
  });
});

describe("cache bounds", () => {
  test("invalidateNamespace clears entries; stats stay bounded", async () => {
    for (let i = 0; i < 50; i++) {
      await cached("t6", `k${i}`, 60_000, async () => i);
    }
    const before = cacheStats();
    expect(before.entries).toBeGreaterThanOrEqual(50);
    invalidateNamespace("t6");
    const after = cacheStats();
    expect(after.entries).toBeLessThan(before.entries);
  });
});
