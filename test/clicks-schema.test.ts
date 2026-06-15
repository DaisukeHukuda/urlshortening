import { env } from "cloudflare:test";
import { expect, it } from "vitest";

it("clicks table exists and accepts an event row", async () => {
  await env.DB.prepare(
    "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind("abc123", 1000, "JP", "t.co", "mobile", "iOS", "Safari")
    .run();

  const row = await env.DB.prepare(
    "SELECT code, ts, country, referer, device, os, browser FROM clicks WHERE code = ?",
  )
    .bind("abc123")
    .first<{ code: string; ts: number; country: string }>();

  expect(row?.code).toBe("abc123");
  expect(row?.ts).toBe(1000);
  expect(row?.country).toBe("JP");
});
