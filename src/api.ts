import {
  COOKIE_NAME,
  buildSetCookie,
  clearCookie,
  createSession,
  readCookie,
  verifyPassword,
  verifySession,
} from "./auth";
import {
  createLink,
  deleteLink,
  getLink,
  isValidUrl,
  LinkError,
  listLinks,
  updateLink,
} from "./links";
import { getStats } from "./stats";
import type { Env } from "./types";
import { createUser, getUserByUsername, UserError } from "./users";

const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

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

  // --- Public routes (no auth required) ---

  if (path === "/api/register" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    try {
      const user = await createUser(env.DB, body.username ?? "", body.password ?? "", now);
      const token = await createSession(env.AUTH_SECRET, { userId: user.id, username: user.username }, SESSION_TTL, now);
      const ttlSec = SESSION_TTL / 1000;
      return json({ user }, 201, { "Set-Cookie": buildSetCookie(token, ttlSec) });
    } catch (e) {
      if (e instanceof UserError) {
        const status = e.reason === "username_taken" ? 409 : 400;
        return json({ error: e.reason }, status);
      }
      throw e;
    }
  }

  if (path === "/api/login" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const user = await getUserByUsername(env.DB, body.username ?? "");
    if (!user) {
      return json({ error: "invalid_credentials" }, 401);
    }
    const valid = await verifyPassword(body.password ?? "", user.password_salt, user.password_hash);
    if (!valid) {
      return json({ error: "invalid_credentials" }, 401);
    }
    const token = await createSession(env.AUTH_SECRET, { userId: user.id, username: user.username }, SESSION_TTL, now);
    const ttlSec = SESSION_TTL / 1000;
    return json({ user: { id: user.id, username: user.username } }, 200, {
      "Set-Cookie": buildSetCookie(token, ttlSec),
    });
  }

  if (path === "/api/logout" && req.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  }

  // --- Auth gate ---
  const session = await verifySession(env.AUTH_SECRET, readCookie(req, COOKIE_NAME), now);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }

  // --- Authed routes ---

  if (path === "/api/me" && req.method === "GET") {
    return json({ user: { id: session.userId, username: session.username } });
  }

  if (path === "/api/links" && req.method === "GET") {
    return json({ links: await listLinks(env.DB, session.userId) });
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
        session.userId,
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
    const link = await getLink(env.DB, code);
    if (!link || link.user_id !== session.userId) {
      return json({ error: "not found" }, 404);
    }
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
    const link = await getLink(env.DB, code);
    if (!link || link.user_id !== session.userId) {
      return json({ error: "not found" }, 404);
    }
    await deleteLink(env.DB, code);
    return json({ ok: true });
  }

  if (path === "/api/stats" && req.method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) {
      return json({ error: "code required" }, 400);
    }
    const link = await getLink(env.DB, code);
    if (!link || link.user_id !== session.userId) {
      return json({ error: "not found" }, 404);
    }
    return json({ stats: await getStats(env.DB, code) });
  }

  return json({ error: "not found" }, 404);
}
