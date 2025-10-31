// api/_utils.js
const crypto = require('crypto');
const { Resend } = require('resend');
const { parseCookies, makeCookie, appendSetCookie } = require('./_lib/cookies');

const UPSTASH_REDIS_REST_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const VERIFY_CODE_TTL_SECONDS = 60 * 10;

// Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const MAX_BODY_SIZE = 1024 * 1024;

function json(res, obj, code = 200) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body) return req.body;
  let size = 0, chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_SIZE) throw new Error('Request body too large');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString();
  try { req.body = JSON.parse(raw || '{}'); return req.body; }
  catch { req.body = {}; return {}; }
}

async function redis(cmd, ...args) {
  const body = [[ String(cmd).toLowerCase(), ...args.map(v => String(v)) ]];
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Upstash pipeline(s) failed');
  return d[0]?.result;
}

async function redisPipeline(commands) {
  const body = commands.map(([c, ...rest]) => [ String(c).toLowerCase(), ...rest.map(v => String(v)) ]);
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Upstash pipeline failed');
  return d.map(x => x.result);
}

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function uid(){ return crypto.randomBytes(16).toString('hex'); }
function genSalt(){ return crypto.randomBytes(16).toString('hex'); }
function genVerifyCode(){ return crypto.randomInt(100000, 999999).toString(); }

async function sendVerificationEmail(toEmail, code, subject='您的验证码') {
  const html = `<p>您的验证码是：<b>${code}</b></p><p>该验证码10分钟内有效。</p>`;
  return sendEmail(toEmail, subject, html);
}

async function sendEmail(toEmail, subject, html){
  if (!resend || !EMAIL_FROM) {
    console.warn('[Mail] 未配置 RESEND_API_KEY 或 EMAIL_FROM，走模拟发送');
    if (process.env.NODE_ENV !== 'production') {
      console.log(`=== 邮件模拟发送 ===\nTO: ${toEmail}\nSUBJECT: ${subject}\nHTML:\n${html}\n===================`);
      return;
    }
    throw new Error('邮件服务未正确配置');
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject,
      html,
      headers: { 'X-Entity-Request-Id': crypto.randomUUID() }
    });
  } catch (error) {
    console.error('Resend 邮件发送失败:', error);
    throw new Error('邮件发送失败，请稍后重试');
  }
}

const ITER=210000, KEYLEN=32, DIGEST='sha256';
function hashPassword(pw, s) { const hex = crypto.pbkdf2Sync(String(pw), String(s), ITER, KEYLEN, DIGEST).toString('hex'); return `v1$${ITER}$${s}$${hex}`; }
function verifyPassword(pw, stored) {
  const [v, iter, salt, hex] = String(stored).split('$');
  if (v !== 'v1') return false;
  const h2 = crypto.pbkdf2Sync(String(pw), String(salt), Number(iter), KEYLEN, DIGEST).toString('hex');
  return h2 === hex;
}

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
    ['set', `user:uid:${user.uid}`, email],
    ['sadd', 'users:all', user.uid] // 记录所有用户，便于 Cron 扫描
  ]);
  return { user };
}

async function createSession(res, uid) {
  const sid = crypto.randomBytes(32).toString('hex');
  await redis('setex', `sess:${sid}`, String(TTL_DAYS * 86400), uid);
  const cookie = makeCookie('sid', sid, {
    maxAge: TTL_DAYS * 86400, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/'
  });
  appendSetCookie(res, cookie);
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
  const cookie = makeCookie('sid', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' });
  appendSetCookie(res, cookie);
}

module.exports = {
  json, readBody,
  redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser, createSession, getUserIdBySession,
  TTL: TTL_DAYS, destroySession,
  genVerifyCode, sendVerificationEmail, sendEmail,
  VERIFY_CODE_TTL_SECONDS,
};
