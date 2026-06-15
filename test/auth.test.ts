import { describe, expect, it } from "vitest";
import {
  createSession,
  hashPassword,
  verifyPassword,
  verifySession,
} from "../src/auth";

describe("hashPassword / verifyPassword", () => {
  it("roundtrip: correct password verifies true", async () => {
    const { salt, hash } = await hashPassword("correct-password-123");
    expect(await verifyPassword("correct-password-123", salt, hash)).toBe(true);
  });

  it("wrong password verifies false", async () => {
    const { salt, hash } = await hashPassword("correct-password-123");
    expect(await verifyPassword("wrong-password-456", salt, hash)).toBe(false);
  });
});

describe("createSession / verifySession", () => {
  const SECRET = "test-secret-at-least-32-characters-long";
  const NOW = 1_000_000;
  const TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

  it("roundtrip: returns the session payload", async () => {
    const session = { userId: 42, username: "alice" };
    const token = await createSession(SECRET, session, TTL, NOW);
    const result = await verifySession(SECRET, token, NOW);
    expect(result).toEqual(session);
  });

  it("expired session returns null", async () => {
    const token = await createSession(SECRET, { userId: 1, username: "bob" }, 1000, NOW);
    // verify at NOW + 2000 (past expiry)
    const result = await verifySession(SECRET, token, NOW + 2000);
    expect(result).toBeNull();
  });

  it("tampered token returns null", async () => {
    const token = await createSession(SECRET, { userId: 1, username: "bob" }, TTL, NOW);
    const tampered = token.slice(0, -4) + "xxxx";
    const result = await verifySession(SECRET, tampered, NOW);
    expect(result).toBeNull();
  });

  it("wrong secret returns null", async () => {
    const token = await createSession(SECRET, { userId: 1, username: "bob" }, TTL, NOW);
    const result = await verifySession("wrong-secret-at-least-32-chars-long", token, NOW);
    expect(result).toBeNull();
  });

  it("null token returns null", async () => {
    const result = await verifySession(SECRET, null, NOW);
    expect(result).toBeNull();
  });
});
