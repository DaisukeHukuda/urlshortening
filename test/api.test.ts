import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleApi } from "../src/api";
import { getLink } from "../src/links";

const NOW = 1_000_000;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
  await env.DB.prepare("DELETE FROM clicks").run();
});

function post(path: string, body: unknown): Request {
  return new Request(`http://x${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("links API", () => {
  it("creates a link and lists it", async () => {
    const createRes = await handleApi(
      post("/api/links", { target_url: "https://example.com", title: "Ex" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { link: { code: string } };
    expect(created.link.code).toMatch(/^[0-9A-Za-z]{6}$/);

    const listRes = await handleApi(
      new Request("http://x/api/links"),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as { links: unknown[] };
    expect(listed.links).toHaveLength(1);
  });

  it("rejects an invalid target_url with 400", async () => {
    const res = await handleApi(
      post("/api/links", { target_url: "javascript:alert(1)" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(400);
  });
});

describe("stats API", () => {
  it("returns 400 when code is missing", async () => {
    const res = await handleApi(
      new Request("http://x/api/stats"),
      env,
      new URL("http://x/api/stats"),
      NOW,
    );
    expect(res.status).toBe(400);
  });

  it("returns stats for a code", async () => {
    await env.DB.prepare(
      "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind("sc1", 1704067200000, "JP", "t.co", "mobile", "iOS", "Safari")
      .run();

    const res = await handleApi(
      new Request("http://x/api/stats?code=sc1"),
      env,
      new URL("http://x/api/stats?code=sc1"),
      NOW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stats: { total: number } };
    expect(body.stats.total).toBe(1);
  });
});

describe("create with custom code / expiry", () => {
  it("creates with a custom code", async () => {
    const res = await handleApi(
      post("/api/links", { target_url: "https://example.com", code: "promo" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { link: { code: string } };
    expect(body.link.code).toBe("promo");
  });

  it("returns 409 when the custom code is taken", async () => {
    await handleApi(
      post("/api/links", { target_url: "https://a.com", code: "dup" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    const res = await handleApi(
      post("/api/links", { target_url: "https://b.com", code: "dup" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid custom code", async () => {
    const res = await handleApi(
      post("/api/links", { target_url: "https://a.com", code: "bad code" }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH and DELETE /api/links/:code", () => {
  async function makeLink(code: string) {
    await handleApi(
      post("/api/links", { target_url: "https://a.com", code }),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
  }
  function req(method: string, path: string, body: unknown): Request {
    return new Request(`http://x${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("PATCH updates a link", async () => {
    await makeLink("p1");
    const res = await handleApi(
      req("PATCH", "/api/links/p1", { disabled: true, target_url: "https://b.com" }),
      env,
      new URL("http://x/api/links/p1"),
      NOW,
    );
    expect(res.status).toBe(200);
    const link = await getLink(env.DB, "p1");
    expect(link?.disabled).toBe(1);
    expect(link?.target_url).toBe("https://b.com");
  });

  it("PATCH returns 404 for unknown code", async () => {
    const res = await handleApi(
      req("PATCH", "/api/links/none", { disabled: true }),
      env,
      new URL("http://x/api/links/none"),
      NOW,
    );
    expect(res.status).toBe(404);
  });

  it("DELETE removes a link", async () => {
    await makeLink("del1");
    const res = await handleApi(
      req("DELETE", "/api/links/del1", {}),
      env,
      new URL("http://x/api/links/del1"),
      NOW,
    );
    expect(res.status).toBe(200);
    expect(await getLink(env.DB, "del1")).toBeNull();
  });
});
