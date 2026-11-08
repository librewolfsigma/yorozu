import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("password hashing (scrypt)", () => {
  test("roundtrip: correct password verifies", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(stored).not.toContain("correct horse");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  test("wrong password rejected", () => {
    const stored = hashPassword("hunter2");
    expect(verifyPassword("hunter3", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  test("salts are unique per hash (no rainbow reuse)", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  test("tampered stored hash fails closed", () => {
    const stored = hashPassword("p");
    const parts = stored.split(":");
    const tampered = `${parts[0]}:${"0".repeat(parts[1]?.length ?? 64)}`;
    expect(verifyPassword("p", tampered)).toBe(false);
  });
});
