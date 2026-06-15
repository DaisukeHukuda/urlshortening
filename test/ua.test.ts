import { describe, expect, it } from "vitest";
import { parseUserAgent } from "../src/ua";

describe("parseUserAgent", () => {
  it("classifies iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({
      device: "mobile",
      os: "iOS",
      browser: "Safari",
    });
  });

  it("classifies Android Chrome (mobile)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      device: "mobile",
      os: "Android",
      browser: "Chrome",
    });
  });

  it("classifies Windows Chrome (desktop)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      device: "desktop",
      os: "Windows",
      browser: "Chrome",
    });
  });

  it("classifies macOS Safari (desktop)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(parseUserAgent(ua)).toEqual({
      device: "desktop",
      os: "macOS",
      browser: "Safari",
    });
  });

  it("classifies Edge", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua).browser).toBe("Edge");
  });

  it("classifies Firefox", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(parseUserAgent(ua)).toEqual({
      device: "desktop",
      os: "Linux",
      browser: "Firefox",
    });
  });

  it("classifies iPad as tablet", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua).device).toBe("tablet");
  });

  it("returns unknowns for null", () => {
    expect(parseUserAgent(null)).toEqual({
      device: "unknown",
      os: "unknown",
      browser: "unknown",
    });
  });
});
