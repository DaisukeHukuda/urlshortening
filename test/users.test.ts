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

import {
  listUsers,
  getUserById,
  updateUserPassword,
  generateTempPassword,
} from "../src/users";
import { hashPassword, verifyPassword } from "../src/auth";

describe("listUsers", () => {
  it("returns users with link_count, oldest first", async () => {
    await env.DB.prepare("DELETE FROM links").run();
    const a = await createUser(env.DB, "alice", "password123", NOW);
    await createUser(env.DB, "bob", "password123", NOW + 1);
    await env.DB.prepare(
      "INSERT INTO links (code, target_url, title, created_at, user_id) VALUES (?, ?, ?, ?, ?)",
    ).bind("c1", "https://a.com", null, NOW, a.id).run();

    const users = await listUsers(env.DB);
    expect(users.map((u) => u.username)).toEqual(["alice", "bob"]);
    expect(users[0].link_count).toBe(1);
    expect(users[1].link_count).toBe(0);
  });
});

describe("getUserById", () => {
  it("returns the user row by id, or null", async () => {
    const a = await createUser(env.DB, "carol", "password123", NOW);
    const row = await getUserById(env.DB, a.id);
    expect(row?.username).toBe("carol");
    expect(await getUserById(env.DB, 999999)).toBeNull();
  });
});

describe("updateUserPassword", () => {
  it("changes the stored hash so the new password verifies", async () => {
    const a = await createUser(env.DB, "dave", "password123", NOW);
    const { salt, hash } = await hashPassword("newpassword456");
    await updateUserPassword(env.DB, a.id, hash, salt);
    const row = await getUserById(env.DB, a.id);
    expect(await verifyPassword("newpassword456", row!.password_salt, row!.password_hash)).toBe(true);
    expect(await verifyPassword("password123", row!.password_salt, row!.password_hash)).toBe(false);
  });
});

describe("generateTempPassword", () => {
  it("is at least 8 chars and uses only safe characters", () => {
    const p = generateTempPassword();
    expect(p.length).toBeGreaterThanOrEqual(8);
    expect(p).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/);
  });
});
