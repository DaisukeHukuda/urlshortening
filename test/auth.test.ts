import { describe, expect, it } from "vitest";
import {
  buildSetCookie,
  COOKIE_NAME,
  createToken,
  readCookie,
  verifyToken,
} from "../src/auth";

const SECRET = "test-secret-at-least-32-characters-long";
const NOW = 1_000_000;

describe("token", () => {
  it("verifies a freshly created token", async () => {
    const token = await createToken(SECRET, 10_000, NOW);
    expect(await verifyToken(SECRET, token, NOW)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await createToken(SECRET, 10_000, NOW);
    expect(await verifyToken(SECRET, token, NOW + 20_000)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createToken(SECRET, 10_000, NOW);
    expect(await verifyToken("other-secret-32-characters-long-xx", token, NOW)).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await createToken(SECRET, 10_000, NOW);
    const tampered = token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(await verifyToken(SECRET, tampered, NOW)).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyToken(SECRET, "garbage", NOW)).toBe(false);
  });
});

describe("cookie helpers", () => {
  it("builds a HttpOnly cookie with Max-Age", () => {
    const c = buildSetCookie("abc", 3600);
    expect(c).toContain(`${COOKIE_NAME}=abc`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Max-Age=3600");
  });

  it("reads a named cookie from the request", () => {
    const req = new Request("http://x/", {
      headers: { Cookie: `${COOKIE_NAME}=value123; other=1` },
    });
    expect(readCookie(req, COOKIE_NAME)).toBe("value123");
  });

  it("returns null when cookie is absent", () => {
    const req = new Request("http://x/");
    expect(readCookie(req, COOKIE_NAME)).toBeNull();
  });
});
