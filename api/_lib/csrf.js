// api/_lib/csrf.js
const crypto = require('crypto');
const { parseCookies, makeCookie, appendSetCookie } = require('./cookies');
const { getOrigin, isWriteMethod } = require('./http');

// 本地用 'csrf'，生产用 '__Host-csrf'
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TTL_SECONDS = 60 * 60 * 24; // 1 天

function ensureCsrfCookie(req, res) {
  const cookies = parseCookies(req);
  let token = cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString('base64url');
    appendSetCookie(res, makeCookie(CSRF_COOKIE, token, {
      httpOnly: false, // CSRF Token 需要 JS 读取放入 Header，所以不能 HttpOnly
      secure: process.env.NODE_ENV === 'production', // 生产环境强制 Secure
      sameSite: 'Strict', // --- 关键：审计要求的 Strict 模式 ---
      path: '/',
      maxAge: CSRF_TTL_SECONDS,
    }));
  }
  return token;
}

function verifyCsrf(req) {
  if (!isWriteMethod(req.method)) return { ok: true };
  const cookies = parseCookies(req);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] || req.headers['x-xsrf-token'];
  
  if (!cookieToken || !headerToken) return { ok: false, reason: 'missing_csrf' };

  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return ok ? { ok: true } : { ok: false, reason: 'bad_csrf' };
  } catch (e) {
    return { ok: false, reason: 'bad_csrf_format' };
  }
}

function verifyOrigin(req, allowed) {
  if (!isWriteMethod(req.method)) return { ok: true };
  const origin = getOrigin(req);
  if (!origin) return { ok: false, reason: 'missing_origin' };
  if (allowed && allowed.length && !allowed.includes(origin)) {
    return { ok: false, reason: 'bad_origin' };
  }
  return { ok: true };
}

module.exports = { CSRF_COOKIE, CSRF_HEADER, ensureCsrfCookie, verifyCsrf, verifyOrigin };