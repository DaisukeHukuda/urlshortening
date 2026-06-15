import { env } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import { createLink, getLink } from "../src/links";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
});

it("new links default to enabled with no expiry", async () => {
  const link = await createLink(env.DB, "https://example.com", null, 100);
  expect(link.disabled).toBe(0);
  expect(link.expires_at).toBeNull();

  const fetched = await getLink(env.DB, link.code);
  expect(fetched?.disabled).toBe(0);
  expect(fetched?.expires_at).toBeNull();
});
