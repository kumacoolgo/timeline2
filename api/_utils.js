const crypto = require('crypto');

const {
  UPSTASH_REDIS_REST_URL = '',
  UPSTASH_REDIS_REST_TOKEN = '',
  SESSION_TTL_SECONDS = '1209600',
} = process.env;

const TTL = parseInt(SESSION_TTL_SECONDS, 10) || 1209600;

async function redis(cmd, ...args) {
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/${cmd.toLowerCase()}`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
  return data.result;
}

async function redisPipeline(commands) {
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(commands)
  });
  const data = await r.json().catch(() => []);
  if (!r.ok) throw new Error(data?.error || `Upstash pipeline failed`);
  return data.map(x => x.result);
}

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const hdr = req.headers.cookie || '';
  const out = {};
  hdr.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, name, val, opt = {}) {
  const parts = [`${name}=${encodeURIComponent(val)}`];
  if (opt.httpOnly !== false) parts.push('HttpOnly');
  parts.push('Path=/');
  parts.push('SameSite=Lax');
  if (opt.maxAge) parts.push(`Max-Age=${opt.maxAge}`);
  if (opt.secure !== false) parts.push('Secure');
  res.setHeader('set-cookie', parts.join('; '));
}

async function readBody(req) {
  const bufs = [];
  for await (const ch of req) bufs.push(ch);
  const s = Buffer.concat(bufs).toString('utf8') || '{}';
  try { return JSON.parse(s); } catch { return {}; }
}

function normEmail(e=''){ return String(e).trim().toLowerCase(); }
function uid(){ return crypto.randomUUID?.() || ('u_' + Date.now().toString(36)+Math.random().toString(36).slice(2,8)); }
function genSalt(n=16){ return crypto.randomBytes(n).toString('hex'); }
function hashPassword(pw, salt){
  const iters = 210000;
  const key = crypto.pbkdf2Sync(String(pw), String(salt), iters, 32, 'sha256');
  return `pbkdf2$${iters}$${salt}$${key.toString('hex')}`;
}
function verifyPassword(pw, hash){
  const [algo, itersStr, salt, digest] = String(hash).split('$');
  if (algo!=='pbkdf2') return false;
  const iters = parseInt(itersStr,10)||210000;
  const key = crypto.pbkdf2Sync(String(pw), String(salt), iters, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key,'hex'), Buffer.from(digest,'hex'));
}

async function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const k = `rl:${ip}`;
  try{
    const [cnt] = await redisPipeline([['INCR', k], ['EXPIRE', k, 60]]);
    return (cnt <= 30);
  }catch{ return true; }
}

async function getUserByEmail(email) {
  const key = `user:email:${normEmail(email)}`;
  const s = await redis('GET', key);
  return s ? JSON.parse(s) : null;
}
async function createUser(email, password) {
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('EXISTS', key);
  if (exists) return { error: '邮箱已存在' };
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redisPipeline([
    ['SET', key, JSON.stringify(user)],
    ['SET', `user:uid:${user.uid}`, user.email]
  ]);
  return { user };
}
async function createSession(res, uid) {
  const sid = 's_' + crypto.randomBytes(18).toString('hex');
  await redisPipeline([['SET', `sid:${sid}`, uid], ['EXPIRE', `sid:${sid}`, TTL]]);
  setCookie(res, 'sid', sid, { maxAge: TTL });
}
async function destroySession(req, res) {
  const sid = parseCookies(req).sid;
  if (sid) await redis('DEL', `sid:${sid}`);
  setCookie(res, 'sid', '', { maxAge: 0 });
}
async function getUserIdBySession(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const uid = await redis('GET', `sid:${sid}`);
  return uid || null;
}

module.exports = {
  json, readBody, parseCookies, setCookie, redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  createUser, getUserByEmail, createSession, destroySession, getUserIdBySession,
  TTL, checkRateLimit
};
