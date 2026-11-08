import { describe, expect, test } from "bun:test";
import { dedupeByRef, toWorkDTO, workRef } from "@/lib/serialize";

function item(over: Partial<Parameters<typeof toWorkDTO>[0]> = {}): Parameters<typeof toWorkDTO>[0] {
  return {
    externalId: "id-1",
    title: "Test Title",
    category: "MANGA",
    ...over,
  } as Parameters<typeof toWorkDTO>[0];
}

describe("workRef", () => {
  test("joins provider + externalId", () => {
    expect(workRef("nhentai", "694781")).toBe("nhentai:694781");
  });
});

describe("toWorkDTO", () => {
  test("maps identity + provider attribution", () => {
    const dto = toWorkDTO(item(), { id: "nhentai", name: "nhentai", canWatch: false, canRead: true, canView: false });
    expect(dto.title).toBe("Test Title");
    expect(dto.provider).toBe("nhentai");
    expect(dto.providerName).toBe("nhentai");
    expect(dto.externalId).toBe("id-1");
    expect(dto.availability.read).toBe(true);
    expect(dto.availability.watch).toBe(false);
  });

  test("minimal item still yields a stable ref", () => {
    const dto = toWorkDTO(item({ title: undefined as unknown as string }), { id: "x", name: "X", canWatch: false, canRead: false, canView: false });
    expect(typeof dto.ref).toBe("string");
    expect(dto.ref.length).toBeGreaterThan(0);
  });
});

describe("dedupeByRef", () => {
  test("keeps first occurrence, drops later duplicates", () => {
    const a = toWorkDTO(item({ externalId: "1" }), { id: "p", name: "P", canWatch: false, canRead: false, canView: false });
    const b = toWorkDTO(item({ externalId: "1" }), { id: "p", name: "P", canWatch: false, canRead: false, canView: false });
    const c = toWorkDTO(item({ externalId: "2" }), { id: "p", name: "P", canWatch: false, canRead: false, canView: false });
    const out = dedupeByRef([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0].externalId).toBe("1");
    expect(out[1].externalId).toBe("2");
  });

  test("empty input → empty output", () => {
    expect(dedupeByRef([])).toHaveLength(0);
  });
});
