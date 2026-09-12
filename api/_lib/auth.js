import crypto from "node:crypto";

// Admin session auth. Before this, /api/admin took the export token as a
// query parameter, which meant the secret rode in every URL — logged by the
// platform, kept in browser history, and easy to leak by pasting a link.
// Now a password is exchanged once for a signed, httpOnly session cookie.
//
// The query token still works so existing bookmarks and scripts don't break;
// the login flow simply stops putting it in URLs.

export const COOKIE_NAME = "nln_admin";
export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

// The password is ADMIN_PASSWORD when set, otherwise the existing export
// token. That fallback matters: without it, deploying this change would lock
// Alex out of his own admin page until he added a new env var.
export function adminSecret() {
  return process.env.ADMIN_PASSWORD || process.env.LEADS_EXPORT_TOKEN || "";
}

// Compares without leaking length or content through timing.
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

// Session value is payload.signature. The signing key is the password
// itself, so changing the password invalidates every outstanding session
// without needing anywhere to store them.
export function createSession(secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + SESSION_MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(value, secret, now = Date.now()) {
  if (!value || !secret) return false;
  const [payload, signature] = String(value).split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

// Secure is set everywhere Vercel serves (always HTTPS) but omitted for
// local http://localhost, where a Secure cookie would simply be dropped.
export function sessionCookie(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.VERCEL) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie() {
  return sessionCookie("", 0);
}

// True when the request carries a valid session cookie, or the legacy
// ?token= query parameter.
export function isAuthorized(req) {
  const secret = adminSecret();
  if (!secret) return false;

  const cookies = parseCookies(req.headers?.cookie);
  if (verifySession(cookies[COOKIE_NAME], secret)) return true;

  const token = process.env.LEADS_EXPORT_TOKEN;
  if (token && req.query?.token && safeEqual(req.query.token, token)) {
    return true;
  }
  return false;
}
