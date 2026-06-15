import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getStats } from "../src/stats";

// 2024-01-01T00:00:00Z = 1704067200000 ms
const DAY1 = 1704067200000;
const DAY2 = DAY1 + 24 * 60 * 60 * 1000; // 2024-01-02

async function insertClick(
  code: string,
  ts: number,
  country: string | null,
  referer: string,
  device: string,
  os: string,
  browser: string,
) {
  await env.DB.prepare(
    "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(code, ts, country, referer, device, os, browser)
    .run();
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM clicks").run();
});

describe("getStats", () => {
  it("aggregates total, by day, and by dimension", async () => {
    await insertClick("c1", DAY1, "JP", "t.co", "mobile", "iOS", "Safari");
    await insertClick("c1", DAY1 + 1000, "JP", "direct", "desktop", "Windows", "Chrome");
    await insertClick("c1", DAY2, "US", "t.co", "mobile", "Android", "Chrome");
    await insertClick("other", DAY1, "JP", "t.co", "mobile", "iOS", "Safari"); // different code, must be excluded

    const stats = await getStats(env.DB, "c1");

    expect(stats.total).toBe(3);

    expect(stats.byDay).toEqual([
      { key: "2024-01-01", count: 2 },
      { key: "2024-01-02", count: 1 },
    ]);

    // ordered by count desc
    expect(stats.byCountry).toEqual([
      { key: "JP", count: 2 },
      { key: "US", count: 1 },
    ]);
    expect(stats.byReferer[0]).toEqual({ key: "t.co", count: 2 });
    expect(stats.byBrowser).toEqual([
      { key: "Chrome", count: 2 },
      { key: "Safari", count: 1 },
    ]);
  });

  it("returns zero/empty for a code with no clicks", async () => {
    const stats = await getStats(env.DB, "nope");
    expect(stats.total).toBe(0);
    expect(stats.byDay).toEqual([]);
    expect(stats.byCountry).toEqual([]);
  });

  it("labels NULL country as 'unknown'", async () => {
    await insertClick("c2", DAY1, null, "direct", "desktop", "macOS", "Safari");
    const stats = await getStats(env.DB, "c2");
    expect(stats.byCountry).toEqual([{ key: "unknown", count: 1 }]);
  });
});
