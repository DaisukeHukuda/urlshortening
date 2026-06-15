import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createLink, getLink } from "../src/links";
import { handleRedirect } from "../src/redirect";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
  await env.DB.prepare("DELETE FROM clicks").run();
});

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x/", { headers });
}

describe("handleRedirect", () => {
  it("302-redirects, increments click_count, and records a click event", async () => {
    const link = await createLink(env.DB, "https://example.com/", null, 1);

    const ctx = createExecutionContext();
    const res = await handleRedirect(
      reqWith({
        "CF-IPCountry": "JP",
        Referer: "https://t.co/abc",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      }),
      link.code,
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/");

    const updated = await getLink(env.DB, link.code);
    expect(updated?.click_count).toBe(1);

    const click = await env.DB.prepare(
      "SELECT country, referer, device, os, browser FROM clicks WHERE code = ?",
    )
      .bind(link.code)
      .first<{
        country: string;
        referer: string;
        device: string;
        os: string;
        browser: string;
      }>();
    expect(click).toEqual({
      country: "JP",
      referer: "t.co",
      device: "mobile",
      os: "iOS",
      browser: "Safari",
    });
  });

  it("records referer as 'direct' when there is no Referer header", async () => {
    const link = await createLink(env.DB, "https://example.com/", null, 1);
    const ctx = createExecutionContext();
    await handleRedirect(reqWith({}), link.code, env, ctx);
    await waitOnExecutionContext(ctx);

    const click = await env.DB.prepare(
      "SELECT referer FROM clicks WHERE code = ?",
    )
      .bind(link.code)
      .first<{ referer: string }>();
    expect(click?.referer).toBe("direct");
  });

  it("returns 404 for an unknown code and records no click", async () => {
    const ctx = createExecutionContext();
    const res = await handleRedirect(reqWith({}), "missing", env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);

    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM clicks").first<{
      n: number;
    }>();
    expect(n?.n).toBe(0);
  });
});

describe("handleRedirect disabled / expired", () => {
  it("returns 410 for a disabled link and records no click", async () => {
    await createLink(env.DB, "https://example.com/", null, 1, "dis1");
    await env.DB.prepare("UPDATE links SET disabled = 1 WHERE code = ?")
      .bind("dis1")
      .run();

    const ctx = createExecutionContext();
    const res = await handleRedirect(reqWith({}), "dis1", env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(410);
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM clicks WHERE code = ?",
    )
      .bind("dis1")
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("returns 410 for an expired link", async () => {
    // expires in the past
    await createLink(env.DB, "https://example.com/", null, 1, "exp1", 1000);

    const ctx = createExecutionContext();
    const res = await handleRedirect(reqWith({}), "exp1", env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(410);
  });
});
