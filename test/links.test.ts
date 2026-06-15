import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createLink, deleteLink, getLink, isValidUrl, LinkError, listLinks, updateLink, validateCustomCode } from "../src/links";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
  await env.DB.prepare("DELETE FROM clicks").run();
});

describe("isValidUrl", () => {
  it("accepts http and https", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path?q=1")).toBe(true);
  });
  it("rejects non-http schemes and garbage", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("createLink / getLink / listLinks", () => {
  it("creates a link with a generated code and zero clicks", async () => {
    const link = await createLink(env.DB, "https://example.com", "Example", 123);
    expect(link.code).toMatch(/^[0-9A-Za-z]{6}$/);
    expect(link.target_url).toBe("https://example.com");
    expect(link.title).toBe("Example");
    expect(link.created_at).toBe(123);
    expect(link.click_count).toBe(0);

    const fetched = await getLink(env.DB, link.code);
    expect(fetched?.target_url).toBe("https://example.com");
  });

  it("returns null for an unknown code", async () => {
    expect(await getLink(env.DB, "nope12")).toBeNull();
  });

  it("lists links newest first", async () => {
    await createLink(env.DB, "https://a.com", null, 100, undefined, undefined, 1);
    await createLink(env.DB, "https://b.com", null, 200, undefined, undefined, 1);
    const links = await listLinks(env.DB, 1);
    expect(links).toHaveLength(2);
    expect(links[0].target_url).toBe("https://b.com");
    expect(links[1].target_url).toBe("https://a.com");
  });
});

describe("validateCustomCode", () => {
  it("accepts alnum, dash, underscore up to 32 chars", () => {
    expect(validateCustomCode("sale")).toBe(true);
    expect(validateCustomCode("My_Promo-2026")).toBe(true);
  });
  it("rejects empty, too long, bad chars, and reserved words", () => {
    expect(validateCustomCode("")).toBe(false);
    expect(validateCustomCode("a".repeat(33))).toBe(false);
    expect(validateCustomCode("has space")).toBe(false);
    expect(validateCustomCode("foo/bar")).toBe(false);
    expect(validateCustomCode("api")).toBe(false);
    expect(validateCustomCode("ADMIN")).toBe(false);
  });
});

describe("createLink with custom code / expiry", () => {
  it("uses the provided custom code", async () => {
    const link = await createLink(env.DB, "https://example.com", null, 1, "promo");
    expect(link.code).toBe("promo");
  });
  it("stores expires_at when provided", async () => {
    const link = await createLink(env.DB, "https://example.com", null, 1, "exp1", 5000);
    expect(link.expires_at).toBe(5000);
    const fetched = await getLink(env.DB, "exp1");
    expect(fetched?.expires_at).toBe(5000);
  });
  it("throws LinkError(invalid_code) for a bad custom code", async () => {
    await expect(
      createLink(env.DB, "https://example.com", null, 1, "bad code"),
    ).rejects.toMatchObject({ reason: "invalid_code" });
  });
  it("throws LinkError(code_taken) when the code already exists", async () => {
    await createLink(env.DB, "https://example.com", null, 1, "dup");
    await expect(
      createLink(env.DB, "https://other.com", null, 2, "dup"),
    ).rejects.toMatchObject({ reason: "code_taken" });
  });
});

describe("updateLink", () => {
  it("updates only the provided fields", async () => {
    await createLink(env.DB, "https://a.com", "old", 1, "u1");
    const ok = await updateLink(env.DB, "u1", {
      target_url: "https://b.com",
      disabled: 1,
    });
    expect(ok).toBe(true);
    const link = await getLink(env.DB, "u1");
    expect(link?.target_url).toBe("https://b.com");
    expect(link?.title).toBe("old"); // untouched
    expect(link?.disabled).toBe(1);
  });
  it("returns false for an unknown code", async () => {
    expect(await updateLink(env.DB, "missing", { disabled: 1 })).toBe(false);
  });
  it("returns false when no fields are given", async () => {
    await createLink(env.DB, "https://a.com", null, 1, "u2");
    expect(await updateLink(env.DB, "u2", {})).toBe(false);
  });
});

describe("deleteLink", () => {
  it("removes the link and its click rows", async () => {
    await createLink(env.DB, "https://a.com", null, 1, "d1");
    await env.DB.prepare(
      "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind("d1", 1, "JP", "direct", "desktop", "macOS", "Safari")
      .run();

    await deleteLink(env.DB, "d1");

    expect(await getLink(env.DB, "d1")).toBeNull();
    const clicks = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM clicks WHERE code = ?",
    )
      .bind("d1")
      .first<{ n: number }>();
    expect(clicks?.n).toBe(0);
  });
});
