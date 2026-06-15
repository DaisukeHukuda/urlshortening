import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { createLink } from "../src/links";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
});

describe("worker fetch routing", () => {
  it("routes /api/* to the API (returns the links list)", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("http://x/api/links"),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { links: unknown[] };
    expect(Array.isArray(body.links)).toBe(true);
  });

  it("routes a single-segment GET to the redirect handler", async () => {
    const link = await createLink(env.DB, "https://example.com/", null, 1);
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request(`http://x/${link.code}`),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/");
  });

  it("returns 404 for an unknown code", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("http://x/missing"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
