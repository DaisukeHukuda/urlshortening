import { getLink } from "./links";
import type { Env } from "./types";
import { parseUserAgent } from "./ua";

function refererHost(referer: string | null): string {
  if (!referer) return "direct";
  try {
    return new URL(referer).hostname || "direct";
  } catch {
    return "direct";
  }
}

export async function handleRedirect(
  req: Request,
  code: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const link = await getLink(env.DB, code);
  if (!link) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const now = Date.now();
  if (link.disabled || (link.expires_at !== null && now > link.expires_at)) {
    return new Response("このリンクは利用できません。", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const country = req.headers.get("CF-IPCountry");
  const referer = refererHost(req.headers.get("Referer"));
  const { device, os, browser } = parseUserAgent(req.headers.get("User-Agent"));

  // Record the click asynchronously so the redirect is never delayed.
  ctx.waitUntil(
    env.DB.batch([
      env.DB
        .prepare("UPDATE links SET click_count = click_count + 1 WHERE code = ?")
        .bind(code),
      env.DB
        .prepare(
          "INSERT INTO clicks (code, ts, country, referer, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(code, now, country, referer, device, os, browser),
    ]),
  );

  return Response.redirect(link.target_url, 302);
}
