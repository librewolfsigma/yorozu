import { describe, expect, test } from "bun:test";
import { interleaveRoundRobin } from "@/lib/providers/engine";
import type { WorkDTO } from "@/lib/serialize";

function mk(ref: string, popularity = 0): WorkDTO {
  return {
    ref,
    provider: "p",
    providerName: "P",
    externalId: ref,
    title: `T ${ref}`,
    category: "AV",
    popularity,
  } as WorkDTO;
}

describe("interleaveRoundRobin — the fair-share feed core", () => {
  test("cycles across providers at every depth (A B C A B C …)", () => {
    const a = [mk("a1"), mk("a2"), mk("a3")];
    const b = [mk("b1"), mk("b2"), mk("b3")];
    const c = [mk("c1"), mk("c2"), mk("c3")];
    const out = interleaveRoundRobin([a, b, c]);
    expect(out.map((x) => x.ref)).toEqual(["a1", "b1", "c1", "a2", "b2", "c2", "a3", "b3", "c3"]);
  });

  test("one heavy provider cannot crowd out others (the old 14-item bug)", () => {
    const heavy = Array.from({ length: 30 }, (_, i) => mk(`h${i}`));
    const small = [mk("s1"), mk("s2")];
    const out = interleaveRoundRobin([heavy, small]);
    // positions 0 and 2 must come from the small provider (one item per depth pass)
    expect(out[0].ref).toBe("h0");
    expect(out[1].ref).toBe("s1");
    expect(out[3].ref).toBe("s2");
  });

  test("dedupes identical refs across providers on first sight", () => {
    const a = [mk("x"), mk("a1")];
    const b = [mk("x"), mk("b1")];
    const out = interleaveRoundRobin([a, b]);
    expect(out.map((x) => x.ref)).toEqual(["x", "a1", "b1"]);
  });

  test("skips failed/empty queues gracefully", () => {
    const out = interleaveRoundRobin([[], [mk("b1")], []]);
    expect(out.map((x) => x.ref)).toEqual(["b1"]);
    expect(interleaveRoundRobin([[], []])).toHaveLength(0);
  });

  test("respects the per-request cap", () => {
    const a = Array.from({ length: 80 }, (_, i) => mk(`a${i}`));
    const b = Array.from({ length: 80 }, (_, i) => mk(`b${i}`));
    expect(interleaveRoundRobin([a, b], 120)).toHaveLength(120);
  });

  test("does not mutate the caller's queues", () => {
    const a = [mk("a1")];
    interleaveRoundRobin([a]);
    expect(a).toHaveLength(1);
  });
});
