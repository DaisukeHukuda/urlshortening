/* =========================================================================
   User accounts. Self-signup (username + password), PBKDF2-hashed.
   ========================================================================= */
import { hashPassword } from "./auth";

export class UserError extends Error {
  constructor(
    public reason:
      | "invalid_username"
      | "invalid_password"
      | "username_taken"
      | "invalid_credentials",
  ) {
    super(reason);
  }
}

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  created_at: number;
}

// Allows plain usernames and email addresses (letters, digits, . _ % + - @).
const USERNAME_RE = /^[A-Za-z0-9._%+\-@]{3,254}$/;

export function validateUsername(u: string): boolean {
  return typeof u === "string" && USERNAME_RE.test(u);
}
export function validatePassword(p: string): boolean {
  return typeof p === "string" && p.length >= 8 && p.length <= 200;
}

export async function createUser(
  db: D1Database,
  username: string,
  password: string,
  now: number,
): Promise<{ id: number; username: string }> {
  if (!validateUsername(username)) throw new UserError("invalid_username");
  if (!validatePassword(password)) throw new UserError("invalid_password");
  const { salt, hash } = await hashPassword(password);
  try {
    const res = await db
      .prepare(
        "INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(username, hash, salt, now)
      .run();
    return { id: Number(res.meta.last_row_id), username };
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new UserError("username_taken");
    throw e;
  }
}

export async function getUserByUsername(
  db: D1Database,
  username: string,
): Promise<UserRow | null> {
  const row = await db
    .prepare(
      "SELECT id, username, password_hash, password_salt, created_at FROM users WHERE username = ?",
    )
    .bind(username)
    .first<UserRow>();
  return row ?? null;
}
