
// api/_utils.js (hardened)
const crypto = require('crypto');

// --- Environment variables (do NOT log them) ---
const UPSTASH_REDIS_REST_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const VERIFY_CODE_TTL_SECONDS = 60 * 10; // 10 minutes
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

// --- Resend ---
const { Resend } = require('resend');
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// --- Basic helpers ---
function appendSetCookie(res, v) {
  const prev = res.getHeader('set-cookie');
  if (!prev) res.setHeader('set-cookie', v);
  else if (Array.isArray(prev)) res.setHeader('set-cookie', prev.concat(v));
  else res.setHeader('set-cookie', [prev, v]);
}
function setCookie(res, name, value, opt = {}) {
  const a = [`${name}=${encodeURIComponent(value)}`];
  if (opt.maxAge) a.push(`Max-Age=${opt.maxAge}`);
  a.push('Path=/', 'SameSite=Lax', 'HttpOnly', 'Secure');
  appendSetCookie(res, a.join('; '));
}
function setCookiePublic(res, name, value, opt = {}) {
  const a = [`${name}=${encodeURIComponent(value)}`];
  if (opt.maxAge) a.push(`Max-Age=${opt.maxAge}`);
  a.push('Path=/', 'SameSite=Lax', 'Secure');
  appendSetCookie(res, a.join('; '));
}

function json(res, obj, code=200) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req, {max=1_000_000} = {}) {
  const ctype = String(req.headers['content-type'] || '');
  if (!/application\/json\b/i.test(ctype)) return {};
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw new Error('Payload Too Large');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString();
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function parseCookies(req) {
  const h = req.headers.cookie || '';
  const m = {};
  h.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) m[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return m;
}

// --- Redis (Upstash REST) ---
async function redis(cmd, ...args) {
  const body = [[ String(cmd).toLowerCase(), ...args.map(v => String(v)) ]];
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Upstash pipeline(s) failed');
  return d[0]?.result;
}

async function redisPipeline(commands) {
  const body = commands.map(([c, ...rest]) => [
    String(c).toLowerCase(),
    ...rest.map(v => String(v))
  ]);
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Upstash pipeline failed');
  return d.map(x => x.result);
}

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function uid(){ return crypto.randomBytes(16).toString('hex'); }
function genSalt(){ return crypto.randomBytes(16).toString('hex'); }

// OTP
function genVerifyCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// Email
async function sendVerificationEmail(toEmail, code, subject = '您的验证码') {
  if (!resend || !EMAIL_FROM) {
    if (process.env.VERCEL_ENV !== 'production') {
      console.log(`=== 邮件模拟发送 ===\nTO: ${toEmail}\nSUBJECT: ${subject}\nCODE: ${code}\n====================`);
      return;
    }
    throw new Error('邮件服务未正确配置');
  }
  await resend.emails.send({
    from: EMAIL_FROM,
    to: toEmail,
    subject,
    html: `<p>您的验证码是：<b>${code}</b></p><p>该验证码10分钟内有效。</p>`,
  });
}

// Password hashing
const ITER=210000, KEYLEN=32, DIGEST='sha256';
function hashPassword(pw, s) {
  const hex = crypto.pbkdf2Sync(String(pw), String(s), ITER, KEYLEN, DIGEST).toString('hex');
  return `v1$${ITER}$${s}$${hex}`;
}
function verifyPassword(pw, stored) {
  const [v, iter, salt, hex] = String(stored).split('$');
  if (v !== 'v1') return false;
  const h2 = crypto.pbkdf2Sync(String(pw), String(salt), Number(iter), KEYLEN, DIGEST).toString('hex');
  return h2 === hex;
}

// Users & sessions
async function getUserByEmail(email) {
  const key = `user:email:${normEmail(email)}`;
  const raw = await redis('get', key);
  return raw ? JSON.parse(raw) : null;
}

async function createUser(email, password) {
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('exists', key);
  if (exists) return { error: 'exists' };
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redisPipeline([
    ['set', key, JSON.stringify(user)],
    ['set', `user:uid:${user.uid}`, email]
  ]);
  return { user };
}

function randomSid() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(res, uid) {
  const sid = randomSid(); // do not expose uid in SID
  await redis('setex', `sess:${sid}`, String(TTL_DAYS * 86400), uid);
  setCookie(res, 'sid', sid, { maxAge: TTL_DAYS * 86400 });
  return sid;
}

async function getUserIdBySession(req) {
  const sid = (parseCookies(req).sid);
  if (!sid) return null;
  return await redis('get', `sess:${sid}`);
}

async function destroySession(req, res) {
  const sid = (parseCookies(req).sid);
  if (sid) await redis('del', `sess:${sid}`);
  setCookie(res, 'sid', '', { maxAge: 0 });
}

// --- CSRF (double submit cookie) ---
function ensureCsrfCookie(req, res) {
  const c = parseCookies(req).csrf;
  if (c) return c;
  const token = crypto.randomBytes(16).toString('hex');
  setCookiePublic(res, 'csrf', token, { maxAge: TTL_DAYS * 86400 });
  return token;
}
function requireCsrf(req) {
  const header = String(req.headers['x-csrf-token'] || '');
  const cookie = parseCookies(req).csrf || '';
  return cookie && header && cookie === header;
}

// --- Rate limiting ---
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0').split(',')[0].trim();
}
async function bumpRate(key, windowSec) {
  const n = await redis('incr', key);
  if (n === 1) await redis('expire', key, String(windowSec));
  return n;
}

module.exports = {
  // http
  json, readBody, parseCookies, setCookie, setCookiePublic,
  // redis
  redis, redisPipeline,
  // auth & users
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser, createSession, getUserIdBySession, destroySession,
  // constants
  TTL: TTL_DAYS, VERIFY_CODE_TTL_SECONDS,
  // email / otp
  genVerifyCode, sendVerificationEmail,
  // csrf
  ensureCsrfCookie, requireCsrf,
  // rate / ip
  bumpRate, clientIp
};
