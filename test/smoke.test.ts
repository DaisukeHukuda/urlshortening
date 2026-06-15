import { env } from "cloudflare:test";
import { expect, it } from "vitest";

it("applies migrations: links table is empty initially", async () => {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM links",
  ).all<{ n: number }>();
  expect(results[0].n).toBe(0);
});
