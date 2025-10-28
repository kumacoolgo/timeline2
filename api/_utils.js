// api/_utils.js
const crypto = require('crypto');

const UPSTASH_REDIS_REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;

function json(res,obj,code=200){res.statusCode=code;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
async function readBody(req){const chunks=[];for await(const c of req) chunks.push(c);const raw=Buffer.concat(chunks).toString();try{return JSON.parse(raw||'{}')}catch{return {}}}
function parseCookies(req){const h=req.headers.cookie||'';const m={};h.split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)m[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1))});return m;}
function setCookie(res,name,value,opt={}){const a=[`${name}=${encodeURIComponent(value)}`];if(opt.maxAge)a.push(`Max-Age=${opt.maxAge}`);a.push('Path=/','SameSite=Lax','HttpOnly','Secure');res.setHeader('set-cookie',a.join('; '));}


/** 兼容版：Upstash 官方推荐 GET 走 GET /get/<key>，避免某些 POST /get 不兼容 */
async function redisGetCompat(key) {
  try {
    // 先走你当前 REST 设置默认的 POST /get
    return await redis('get', key);
  } catch (e) {
    // 某些 Upstash 实例仅允许 GET /get/<key>
    const u = `${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
    const r = await fetch(u, {
      method: 'GET',
      headers: { 'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Upstash GET failed');
    return d.result;
  }
}

async function redis(cmd, ...args){
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify([[String(cmd).toUpperCase(), ...args]]),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `Upstash ${cmd} failed`);
  return Array.isArray(d) ? d[0]?.result : d.result; // 兼容返回形态
}

async function redisPipeline(commands){
  const norm = commands.map(c => [String(c[0]).toUpperCase(), ...c.slice(1)]);
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(norm),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Upstash pipeline failed');
  return d.map(x => x.result);
}

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function uid() { return crypto.randomBytes(16).toString('hex'); }
function genSalt() { return crypto.randomBytes(16).toString('hex'); }

const ITER = 210000, KEYLEN = 32, DIGEST = 'sha256';
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

async function getUserByEmail(email){
  const key = `user:email:${normEmail(email)}`;
  const raw = await redisGetCompat(key);
  return raw ? JSON.parse(raw) : null;
}

async function createUser(email, password) {
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redisGetCompat(key);
  if (exists) return { error: 'exists' };

  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };

  await redisPipeline([
    ['set', key, JSON.stringify(user)],
    ['set', `user:uid:${user.uid}`, email],
  ]);
  return { user };
}

async function createSession(res, uid) {
  const sid = uid + ':' + crypto.randomBytes(10).toString('hex');
  await redis('setex', `sess:${sid}`, TTL_DAYS * 86400, uid);
  setCookie(res, 'sid', sid, { maxAge: TTL_DAYS * 86400 });
  return sid;
}

async function getUserIdBySession(req) {
  const sid = (parseCookies(req).sid);
  if (!sid) return null;
  return await redisGetCompat(`sess:${sid}`);
}

async function destroySession(req, res) {
  const sid = (parseCookies(req).sid);
  if (sid) await redis('del', `sess:${sid}`);
  setCookie(res, 'sid', '', { maxAge: 0 });
}

module.exports = {
  json, readBody, parseCookies, setCookie, redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser, createSession, getUserIdBySession,
  TTL: TTL_DAYS,
  destroySession,
  redisGetCompat
};
