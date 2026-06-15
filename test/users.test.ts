import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, getUserByUsername, UserError } from "../src/users";

const NOW = 1_000_000;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("createUser", () => {
  it("returns {id, username} on success", async () => {
    const result = await createUser(env.DB, "alice", "password123", NOW);
    expect(result.id).toBeTypeOf("number");
    expect(result.username).toBe("alice");
  });

  it("throws UserError(username_taken) for duplicate username", async () => {
    await createUser(env.DB, "bob", "password123", NOW);
    await expect(
      createUser(env.DB, "bob", "password456", NOW),
    ).rejects.toMatchObject({ reason: "username_taken" });
    await expect(
      createUser(env.DB, "bob", "password456", NOW),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("throws UserError(invalid_username) for bad username", async () => {
    await expect(
      createUser(env.DB, "ab", "password123", NOW), // too short (< 3 chars)
    ).rejects.toMatchObject({ reason: "invalid_username" });

    await expect(
      createUser(env.DB, "has space", "password123", NOW),
    ).rejects.toMatchObject({ reason: "invalid_username" });
  });

  it("accepts an email address as the username", async () => {
    const result = await createUser(env.DB, "alice@example.com", "password123", NOW);
    expect(result.username).toBe("alice@example.com");
    const user = await getUserByUsername(env.DB, "alice@example.com");
    expect(user?.username).toBe("alice@example.com");
  });

  it("throws UserError(invalid_password) for bad password", async () => {
    await expect(
      createUser(env.DB, "charlie", "short", NOW), // too short (< 8 chars)
    ).rejects.toMatchObject({ reason: "invalid_password" });
  });
});

describe("getUserByUsername", () => {
  it("roundtrip: returns the user after creation", async () => {
    await createUser(env.DB, "dave", "password123", NOW);
    const user = await getUserByUsername(env.DB, "dave");
    expect(user).not.toBeNull();
    expect(user?.username).toBe("dave");
    expect(user?.id).toBeTypeOf("number");
    expect(user?.password_hash).toBeTypeOf("string");
    expect(user?.password_salt).toBeTypeOf("string");
  });

  it("returns null for a non-existent username", async () => {
    const user = await getUserByUsername(env.DB, "nonexistent");
    expect(user).toBeNull();
  });
});
