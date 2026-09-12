import { getRedis } from "./_lib/store.js";
import {
  adminSecret,
  clearCookie,
  createSession,
  safeEqual,
  sessionCookie,
  SESSION_MAX_AGE,
} from "./_lib/auth.js";

// Exchanges the admin password for a session cookie.
//   POST /api/login  { password }        -> sets the session cookie
//   POST /api/login  { logout: true }    -> clears it
//
// Guessing is throttled per IP so the password can't be brute-forced from
// the open internet. Throttling fails open if Redis is unavailable — losing
// the counter shouldn't lock Alex out of his own admin page.

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

const attemptKey = (ip) => `nln:login:attempts:${ip}`;

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, logout } = req.body || {};

  if (logout) {
    res.setHeader("Set-Cookie", clearCookie());
    return res.status(200).json({ ok: true });
  }

  const secret = adminSecret();
  if (!secret) {
    console.error("Login attempted but no ADMIN_PASSWORD/LEADS_EXPORT_TOKEN is set.");
    return res.status(500).json({ error: "Admin access is not configured." });
  }

  const ip = clientIp(req);
  const redis = getRedis();

  if (redis) {
    try {
      const attempts = await redis.incr(attemptKey(ip));
      if (attempts === 1) {
        await redis.expire(attemptKey(ip), WINDOW_SECONDS);
      }
      if (attempts > MAX_ATTEMPTS) {
        return res.status(429).json({
          error: "Too many attempts. Try again in 15 minutes.",
        });
      }
    } catch (err) {
      console.error("Login throttle unavailable:", err);
    }
  }

  if (!password || !safeEqual(password, secret)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  // Successful login clears the counter so normal use never accumulates
  // toward a lockout.
  if (redis) {
    try {
      await redis.del(attemptKey(ip));
    } catch {
      /* not worth failing the login over */
    }
  }

  res.setHeader(
    "Set-Cookie",
    sessionCookie(createSession(secret), SESSION_MAX_AGE)
  );
  return res.status(200).json({ ok: true });
}
