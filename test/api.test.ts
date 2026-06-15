import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleApi } from "../src/api";
import { getLink } from "../src/links";

const NOW = 1_000_000;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
  await env.DB.prepare("DELETE FROM clicks").run();
  await env.DB.prepare("DELETE FROM users").run();
});

function post(path: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`http://x${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function get(path: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`http://x${path}`, { headers });
}

function patch(path: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`http://x${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function del(path: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`http://x${path}`, { method: "DELETE", headers });
}

/** Register a user and return the session cookie value (before the first ";"). */
async function register(username: string, password: string): Promise<string> {
  const res = await handleApi(
    post("/api/register", { username, password }),
    env,
    new URL("http://x/api/register"),
    NOW,
  );
  expect(res.status).toBe(201);
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  // Extract just "session=<token>" part before first ";"
  const cookie = setCookie.split(";")[0];
  return cookie;
}

describe("register", () => {
  it("returns 201 and a Set-Cookie on success", async () => {
    const res = await handleApi(
      post("/api/register", { username: "alice", password: "password123" }),
      env,
      new URL("http://x/api/register"),
      NOW,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: number; username: string } };
    expect(body.user.username).toBe("alice");
    expect(body.user.id).toBeTypeOf("number");
    expect(res.headers.get("Set-Cookie")).toContain("session=");
  });

  it("returns 409 for duplicate username", async () => {
    await register("alice", "password123");
    const res = await handleApi(
      post("/api/register", { username: "alice", password: "password456" }),
      env,
      new URL("http://x/api/register"),
      NOW,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("username_taken");
  });

  it("returns 400 for invalid username", async () => {
    const res = await handleApi(
      post("/api/register", { username: "ab", password: "password123" }),
      env,
      new URL("http://x/api/register"),
      NOW,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_username");
  });

  it("returns 400 for invalid password", async () => {
    const res = await handleApi(
      post("/api/register", { username: "alice", password: "short" }),
      env,
      new URL("http://x/api/register"),
      NOW,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_password");
  });
});

describe("login", () => {
  it("returns 401 for wrong password", async () => {
    await register("alice", "password123");
    const res = await handleApi(
      post("/api/login", { username: "alice", password: "wrongpassword" }),
      env,
      new URL("http://x/api/login"),
      NOW,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_credentials");
  });

  it("returns 401 for unknown user", async () => {
    const res = await handleApi(
      post("/api/login", { username: "nobody", password: "password123" }),
      env,
      new URL("http://x/api/login"),
      NOW,
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with cookie on successful login", async () => {
    await register("alice", "password123");
    const res = await handleApi(
      post("/api/login", { username: "alice", password: "password123" }),
      env,
      new URL("http://x/api/login"),
      NOW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: number; username: string } };
    expect(body.user.username).toBe("alice");
    expect(res.headers.get("Set-Cookie")).toContain("session=");
  });
});

describe("auth gate", () => {
  it("returns 401 for /api/links without cookie", async () => {
    const res = await handleApi(
      get("/api/links"),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  it("returns 200 with cleared cookie", async () => {
    const res = await handleApi(
      post("/api/logout", {}),
      env,
      new URL("http://x/api/logout"),
      NOW,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("authed create + list", () => {
  it("creates a link and lists it for the authenticated user", async () => {
    const cookie = await register("alice", "password123");

    const createRes = await handleApi(
      post("/api/links", { target_url: "https://example.com", title: "Ex" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { link: { code: string } };
    expect(created.link.code).toMatch(/^[0-9A-Za-z]{6}$/);

    const listRes = await handleApi(
      get("/api/links", cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as { links: unknown[] };
    expect(listed.links).toHaveLength(1);
  });
});

describe("ownership isolation", () => {
  it("user B cannot see user A's links, and PATCH/DELETE/stats on A's code returns 404", async () => {
    const cookieA = await register("alice", "password123");
    const cookieB = await register("bob", "password456");

    // User A creates a link
    const createRes = await handleApi(
      post("/api/links", { target_url: "https://alice.com", code: "alink" }, cookieA),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(createRes.status).toBe(201);

    // User B's list does NOT include user A's link
    const listRes = await handleApi(
      get("/api/links", cookieB),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as { links: unknown[] };
    expect(listed.links).toHaveLength(0);

    // User B PATCH on A's code → 404
    const patchRes = await handleApi(
      patch("/api/links/alink", { disabled: true }, cookieB),
      env,
      new URL("http://x/api/links/alink"),
      NOW,
    );
    expect(patchRes.status).toBe(404);

    // User B DELETE on A's code → 404
    const deleteRes = await handleApi(
      del("/api/links/alink", cookieB),
      env,
      new URL("http://x/api/links/alink"),
      NOW,
    );
    expect(deleteRes.status).toBe(404);

    // User B stats on A's code → 404
    const statsRes = await handleApi(
      get("/api/stats?code=alink", cookieB),
      env,
      new URL("http://x/api/stats?code=alink"),
      NOW,
    );
    expect(statsRes.status).toBe(404);
  });
});

describe("invalid target_url and custom code errors", () => {
  it("returns 400 for invalid target_url", async () => {
    const cookie = await register("alice", "password123");
    const res = await handleApi(
      post("/api/links", { target_url: "javascript:alert(1)" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when custom code is taken", async () => {
    const cookie = await register("alice", "password123");
    await handleApi(
      post("/api/links", { target_url: "https://a.com", code: "dup" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    const res = await handleApi(
      post("/api/links", { target_url: "https://b.com", code: "dup" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    expect(res.status).toBe(409);
  });
});

describe("stats for own code", () => {
  it("returns stats data for the authenticated user's own code", async () => {
    const cookie = await register("alice", "password123");

    // Create a link
    await handleApi(
      post("/api/links", { target_url: "https://example.com", code: "sc1" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );

    // Insert a click
    await env.DB.prepare(
      "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind("sc1", 1704067200000, "JP", "t.co", "mobile", "iOS", "Safari")
      .run();

    const res = await handleApi(
      get("/api/stats?code=sc1", cookie),
      env,
      new URL("http://x/api/stats?code=sc1"),
      NOW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stats: { total: number } };
    expect(body.stats.total).toBe(1);
  });
});

describe("/api/me", () => {
  it("returns the authenticated user info", async () => {
    const cookie = await register("alice", "password123");
    const res = await handleApi(
      get("/api/me", cookie),
      env,
      new URL("http://x/api/me"),
      NOW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: number; username: string } };
    expect(body.user.username).toBe("alice");
    expect(body.user.id).toBeTypeOf("number");
  });
});

describe("getLink assertion helper", () => {
  it("getLink returns user_id on the row", async () => {
    const cookie = await register("alice", "password123");
    await handleApi(
      post("/api/links", { target_url: "https://example.com", code: "test1" }, cookie),
      env,
      new URL("http://x/api/links"),
      NOW,
    );
    const link = await getLink(env.DB, "test1");
    expect(link).not.toBeNull();
    expect(link?.user_id).toBeTypeOf("number");
  });
});
