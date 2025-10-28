// api/_utils.js
// Node 18+ (Vercel) CommonJS

const crypto = require('crypto');

/* =================== 基础工具 =================== */
function json(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=0, must-revalidate');
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(/; */).forEach(kv => {
    if (!kv) return;
    const idx = kv.indexOf('=');
    if (idx < 0) return;
    const k = decodeURIComponent(kv.slice(0, idx).trim());
    const v = decodeURIComponent(kv.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  const prev = res.getHeader('Set-Cookie');
  if (prev) {
    const arr = Array.isArray(prev) ? prev.concat(parts.join('; ')) : [prev, parts.join('; ')];
    res.setHeader('Set-Cookie', arr);
  } else {
    res.setHeader('Set-Cookie', parts.join('; '));
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/* =================== Upstash Redis =================== */

async function redis(cmd, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash credentials missing');
  const r = await fetch(`${url}/${String(cmd).toLowerCase()}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
  return data.result;
}

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash credentials missing');
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Upstash pipeline failed');
  return data.map(x => x.result);
}

/* =================== 安全/认证 =================== */

const PBKDF2_ITER = Number(process.env.PBKDF2_ITER || 210000);
const PBKDF2_LEN = 32;           // 256-bit
const PBKDF2_DIGEST = 'sha256';  // 安全 & 快

// v1$ITER$SALT$HEX
function hashPassword(password, salt) {
  const buf = crypto.pbkdf2Sync(
    String(password),
    String(salt),
    PBKDF2_ITER,
    PBKDF2_LEN,
    PBKDF2_DIGEST
  );
  return `v1$${PBKDF2_ITER}$${salt}$${buf.toString('hex')}`;
}

/**
 * 兼容校验：
 * - v1$iter$salt$hex （当前格式）
 * - 旧格式 "iter:salt:hex"
 * - 极旧格式 "salt$hex" 或 "salt:hex"
 * - 仅 hex（无法校验，返回 false）
 */
function verifyPassword(password, stored) {
  if (!stored) return false;
  const s = String(stored);

  // v1$iter$salt$hex
  if (s.startsWith('v1$')) {
    const arr = s.split('$'); // ['v1', iter, salt, hex]
    if (arr.length !== 4) return false;
    const iter = Number(arr[1]) || PBKDF2_ITER;
    const salt = arr[2];
    const hex = arr[3];
    const buf = crypto.pbkdf2Sync(
      String(password),
      String(salt),
      iter,
      Buffer.from(hex, 'hex').length,
      PBKDF2_DIGEST
    );
    return crypto.timingSafeEqual(buf, Buffer.from(hex, 'hex'));
  }

  // iter:salt:hex
  if (/^\d+:[^:]+:[a-f0-9]+$/i.test(s)) {
    const [iterStr, salt, hex] = s.split(':');
    const iter = Number(iterStr) || PBKDF2_ITER;
    const buf = crypto.pbkdf2Sync(
      String(password),
      String(salt),
      iter,
      Buffer.from(hex, 'hex').length,
      PBKDF2_DIGEST
    );
    return crypto.timingSafeEqual(buf, Buffer.from(hex, 'hex'));
  }

  // salt$hex 或 salt:hex
  if (/^[^:$]+[:$][a-f0-9]+$/i.test(s)) {
    const sep = s.includes('$') ? '$' : ':';
    const [salt, hex] = s.split(sep);
    const buf = crypto.pbkdf2Sync(
      String(password),
      String(salt),
      PBKDF2_ITER,
      Buffer.from(hex, 'hex').length,
      PBKDF2_DIGEST
    );
    return crypto.timingSafeEqual(buf, Buffer.from(hex, 'hex'));
  }

  // 仅 hex：无法得知盐，判失败
  return false;
}

function genSalt(len = 16) {
  return crypto.randomBytes(len).toString('hex');
}

function uid(n = 20) {
  return crypto.randomBytes(n).toString('hex');
}

function normEmail(s = '') {
  return String(s).trim().toLowerCase();
}

/* =================== 会话 =================== */

const COOKIE_NAME = 'sid';
// 优先支持秒，便于更精准；否则兼容天
const TTL_SECONDS =
  Number(process.env.SESSION_TTL_SECONDS) ||
  (Number(process.env.SESSION_TTL_DAYS || 14) * 86400);

async function createSession(res, userId) {
  const sid = uid(16);
  await redis('set', `session:${sid}`, userId);
  await redis('expire', `session:${sid}`, TTL_SECONDS);

  setCookie(res, COOKIE_NAME, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
  return sid;
}

async function destroySession(req, res) {
  const sid = parseCookies(req)[COOKIE_NAME];
  if (sid) {
    await redis('del', `session:${sid}`).catch(() => {});
    // 清除 cookie
    setCookie(res, COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

async function getUserIdBySession(req) {
  const sid = parseCookies(req)[COOKIE_NAME];
  if (!sid) return null;
  const uid = await redis('get', `session:${sid}`);
  return uid || null;
}

/* =================== 速率限制（简单按 IP） =================== */

async function checkRateLimit(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  try {
    const key = `limit:ip:${ip}`;
    const [count] = await redisPipeline([
      ['incr', key],
      ['expire', key, 60], // 60 秒窗口
    ]);
    return Number(count) <= 20; // 每分钟最多 20 次
  } catch {
    // Redis 异常时放行，避免把可用性搞挂
    return true;
  }
}

/* =================== 用户存取 =================== */

async function createUser(email, password) {
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('exists', key);
  if (exists) return { error: '邮箱已存在' };

  const salt = genSalt();
  const hash = hashPassword(password, salt); // hash 内嵌版本/迭代/盐
  const user = {
    uid: uid(),
    email,
    salt,        // 冗余保存，方便极端情况迁移
    hash,
    createdAt: Date.now(),
  };

  await redisPipeline([
    ['set', key, JSON.stringify(user)],
    ['set', `user:uid:${user.uid}`, user.email],
  ]);

  return { user };
}

async function getUserByEmail(email) {
  const raw = await redis('get', `user:email:${normEmail(email)}`);
  return raw ? JSON.parse(raw) : null;
}

/* =================== 导出 =================== */

module.exports = {
  // 基础
  json, readBody, parseCookies, setCookie,
  // Redis
  redis, redisPipeline,
  // 安全
  genSalt, uid, hashPassword, verifyPassword, normEmail,
  // 会话
  createSession, destroySession, getUserIdBySession, TTL: TTL_SECONDS,
  // 速率限制
  checkRateLimit,
  // 用户
  createUser, getUserByEmail,
};
