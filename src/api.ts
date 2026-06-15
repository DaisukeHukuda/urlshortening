import {
  buildSetCookie,
  COOKIE_NAME,
  createToken,
  readCookie,
  verifyToken,
} from "./auth";
import {
  createLink,
  deleteLink,
  isValidUrl,
  LinkError,
  listLinks,
  updateLink,
} from "./links";
import { getStats } from "./stats";
import type { Env } from "./types";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export async function handleApi(
  req: Request,
  env: Env,
  url: URL,
  now: number,
): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/login" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      passphrase?: string;
    };
    if (!body.passphrase || body.passphrase !== env.ADMIN_PASSPHRASE) {
      return json({ error: "invalid passphrase" }, 401);
    }
    const token = await createToken(env.AUTH_SECRET, SESSION_TTL_MS, now);
    return json({ ok: true }, 200, {
      "Set-Cookie": buildSetCookie(token, SESSION_TTL_MS / 1000),
    });
  }

  // Everything below requires a valid session.
  const token = readCookie(req, COOKIE_NAME);
  if (!token || !(await verifyToken(env.AUTH_SECRET, token, now))) {
    return json({ error: "unauthorized" }, 401);
  }

  if (path === "/api/links" && req.method === "GET") {
    return json({ links: await listLinks(env.DB) });
  }

  if (path === "/api/links" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      target_url?: string;
      title?: string;
      code?: string;
      expires_at?: number | null;
    };
    if (!body.target_url || !isValidUrl(body.target_url)) {
      return json({ error: "invalid target_url" }, 400);
    }
    try {
      const link = await createLink(
        env.DB,
        body.target_url,
        body.title?.trim() || null,
        now,
        body.code?.trim() || undefined,
        typeof body.expires_at === "number" ? body.expires_at : null,
      );
      return json({ link }, 201);
    } catch (e) {
      if (e instanceof LinkError) {
        return json({ error: e.reason }, e.reason === "code_taken" ? 409 : 400);
      }
      throw e;
    }
  }

  if (path.startsWith("/api/links/") && req.method === "PATCH") {
    const code = decodeURIComponent(path.slice("/api/links/".length));
    const body = (await req.json().catch(() => ({}))) as {
      target_url?: string;
      title?: string | null;
      expires_at?: number | null;
      disabled?: boolean;
    };
    const fields: {
      target_url?: string;
      title?: string | null;
      expires_at?: number | null;
      disabled?: number;
    } = {};
    if (typeof body.target_url === "string") {
      if (!isValidUrl(body.target_url)) {
        return json({ error: "invalid target_url" }, 400);
      }
      fields.target_url = body.target_url;
    }
    if ("title" in body) fields.title = body.title?.toString().trim() || null;
    if ("expires_at" in body) {
      fields.expires_at =
        typeof body.expires_at === "number" ? body.expires_at : null;
    }
    if ("disabled" in body) fields.disabled = body.disabled ? 1 : 0;

    const ok = await updateLink(env.DB, code, fields);
    return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
  }

  if (path.startsWith("/api/links/") && req.method === "DELETE") {
    const code = decodeURIComponent(path.slice("/api/links/".length));
    await deleteLink(env.DB, code);
    return json({ ok: true });
  }

  if (path === "/api/stats" && req.method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) {
      return json({ error: "code required" }, 400);
    }
    return json({ stats: await getStats(env.DB, code) });
  }

  return json({ error: "not found" }, 404);
}
