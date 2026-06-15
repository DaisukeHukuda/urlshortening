import { generateCode } from "./codegen";
import type { LinkRow } from "./types";

export class LinkError extends Error {
  constructor(public reason: "invalid_code" | "code_taken") {
    super(reason);
  }
}

const RESERVED_CODES = new Set([
  "api",
  "admin",
  "index.html",
  "favicon.ico",
  "robots.txt",
]);
const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function validateCustomCode(code: string): boolean {
  return CODE_RE.test(code) && !RESERVED_CODES.has(code.toLowerCase());
}

export function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createLink(
  db: D1Database,
  targetUrl: string,
  title: string | null,
  now: number,
  code?: string,
  expiresAt?: number | null,
  userId?: number,
): Promise<LinkRow> {
  const exp = expiresAt ?? null;
  const uid = userId ?? null;
  const insert = (c: string) =>
    db
      .prepare(
        "INSERT INTO links (code, target_url, title, created_at, click_count, expires_at, disabled, user_id) VALUES (?, ?, ?, ?, 0, ?, 0, ?)",
      )
      .bind(c, targetUrl, title, now, exp, uid)
      .run();

  if (code !== undefined) {
    if (!validateCustomCode(code)) throw new LinkError("invalid_code");
    try {
      await insert(code);
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new LinkError("code_taken");
      throw e;
    }
    return {
      code,
      target_url: targetUrl,
      title,
      created_at: now,
      click_count: 0,
      expires_at: exp,
      disabled: 0,
      user_id: uid,
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const generated = generateCode(6);
    try {
      await insert(generated);
      return {
        code: generated,
        target_url: targetUrl,
        title,
        created_at: now,
        click_count: 0,
        expires_at: exp,
        disabled: 0,
        user_id: uid,
      };
    } catch (e) {
      if (String(e).includes("UNIQUE")) continue;
      throw e;
    }
  }
  throw new Error("could not generate a unique code");
}

export async function getLink(
  db: D1Database,
  code: string,
): Promise<LinkRow | null> {
  const row = await db
    .prepare(
      "SELECT code, target_url, title, created_at, click_count, expires_at, disabled, user_id FROM links WHERE code = ?",
    )
    .bind(code)
    .first<LinkRow>();
  return row ?? null;
}

export async function listLinks(db: D1Database, userId: number): Promise<LinkRow[]> {
  const { results } = await db
    .prepare(
      "SELECT code, target_url, title, created_at, click_count, expires_at, disabled, user_id FROM links WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(userId)
    .all<LinkRow>();
  return results ?? [];
}

export interface LinkUpdate {
  target_url?: string;
  title?: string | null;
  expires_at?: number | null;
  disabled?: number;
}

const UPDATABLE = ["target_url", "title", "expires_at", "disabled"] as const;

export async function updateLink(
  db: D1Database,
  code: string,
  fields: LinkUpdate,
): Promise<boolean> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of UPDATABLE) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      values.push(fields[key] as string | number | null);
    }
  }
  if (sets.length === 0) return false;
  values.push(code);
  const res = await db
    .prepare(`UPDATE links SET ${sets.join(", ")} WHERE code = ?`)
    .bind(...values)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function deleteLink(db: D1Database, code: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM clicks WHERE code = ?").bind(code),
    db.prepare("DELETE FROM links WHERE code = ?").bind(code),
  ]);
}
