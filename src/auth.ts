/* =========================================================================
   Auth primitives: PBKDF2 password hashing + HMAC-signed session cookies.
   Pure Web Crypto (works on Cloudflare Workers). No external deps.
   ========================================================================= */

export const COOKIE_NAME = "session";

const enc = new TextEncoder();
const PBKDF2_ITERS = 100000;

export interface Session {
  userId: number;
  username: string;
}

/* ---- encoding helpers ---- */
function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf as ArrayBuffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---- password hashing (PBKDF2-SHA256, 100k iters, per-user salt) ---- */
export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ salt: string; hash: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return { salt: toHex(salt), hash: toHex(bits) };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string,
): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqual(hash, hashHex);
}

/* ---- session token: "<base64url(json)>.<hex(hmac)>" ---- */
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function createSession(
  secret: string,
  session: Session,
  ttlMs: number,
  now: number,
): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({ uid: session.userId, un: session.username, exp: now + ttlMs }),
  );
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return payload + "." + toHex(sig);
}

export async function verifySession(
  secret: string,
  token: string | null,
  now: number,
): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const key = await hmacKey(secret);
  const expected = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  if (!timingSafeEqual(toHex(expected), sig)) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload)) as {
      uid?: number;
      un?: string;
      exp?: number;
    };
    if (
      typeof data.uid !== "number" ||
      typeof data.un !== "string" ||
      typeof data.exp !== "number" ||
      data.exp < now
    ) {
      return null;
    }
    return { userId: data.uid, username: data.un };
  } catch {
    return null;
  }
}

/* ---- cookies ---- */
export function buildSetCookie(token: string, maxAgeSec: number): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}
export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
