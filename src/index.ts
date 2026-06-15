import { handleApi } from "./api";
import { handleRedirect } from "./redirect";
import type { Env } from "./types";

const RESERVED = new Set(["", "index.html", "favicon.ico", "robots.txt"]);

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const now = Date.now();

    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, env, url, now);
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (
      req.method === "GET" &&
      segments.length === 1 &&
      !RESERVED.has(segments[0])
    ) {
      return handleRedirect(req, segments[0], env, ctx);
    }

    // Static admin UI (index.html, app.js, styles.css, etc.)
    return env.ASSETS.fetch(req);
  },
};
