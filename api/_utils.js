// Upstash + Session + PBKDF2
const crypto = require('crypto');

const TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '30', 10);
const TTL = TTL_DAYS * 24 * 60 * 60;

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

function json(res, obj, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

function parseCookies(req) {
  const h = req.headers['cookie'] || '';
  const out = {};
  h.split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return out;
}

function setCookie(res, name, value, { maxAge = TTL } = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.VERCEL_URL) attrs.push('Secure');
  if (maxAge) attrs.push(`Max-Age=${maxAge}`);
  res.setHeader('Set-Cookie', attrs.join('; '));
}

async function readBody(req) {
  return await new Promise(resolve => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

// Upstash（用 pipeline 包一条命令）
async function redis(cmd, ...args) {
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify([[cmd, ...args]])
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
  return data[0].result;
}

// 用户 & 会话
function normEmail(email) { return String(email || '').trim().toLowerCase(); }
function uid() { return crypto.randomUUID().replace(/-/g, ''); }
function genSalt() { return crypto.randomBytes(16).toString('base64'); }
function hashPassword(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  const hash = crypto.pbkdf2Sync(String(password), salt, 310000, 32, 'sha256').toString('base64');
  return hash;
}

async function createUser(email, password) {
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('EXISTS', key);
  if (exists) return { error: '邮箱已存在' };
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redis('SET', key, JSON.stringify(user));
  return { user };
}

async function getUserByEmail(email) {
  email = normEmail(email);
  const raw = await redis('GET', `user:email:${email}`);
  return raw ? JSON.parse(raw) : null;
}

async function createSession(userId) {
  const sid = uid();
  await redis('SETEX', `sess:${sid}`, TTL, userId);
  return sid;
}
async function destroySession(sid) { await redis('DEL', `sess:${sid}`); }
async function getUserIdBySession(req) {
  const c = parseCookies(req); const raw = c['sid']; if (!raw) return null;
  const uid = await redis('GET', `sess:${raw}`);
  return uid || null;
}

module.exports = {
  json, parseCookies, setCookie, readBody, redis,
  normEmail, uid, genSalt, hashPassword,
  createUser, getUserByEmail,
  createSession, destroySession, getUserIdBySession,
  TTL
};
