// api/_utils.js
const crypto = require('crypto');
const UPSTASH_REDIS_REST_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const VERIFY_CODE_TTL_SECONDS = 60 * 10; // 验证码10分钟有效期

// --- Resend 配置 ---
const { Resend } = require('resend');
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
// --- Resend 配置结束 ---

// 【新增】正文大小限制 (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

function json(res, obj, code=200) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  // 【修改 C.1】添加正文大小限制
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_SIZE) {
      // 抛出错误，将被全局 catch 捕获
      throw new Error('Request body too large');
    }
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

function setCookie(res, name, value, opt={}) {
  const a = [`${name}=${encodeURIComponent(value)}`];
  if (opt.maxAge) a.push(`Max-Age=${opt.maxAge}`);
  // 【修改 B.2】升级为 SameSite=Strict
  a.push('Path=/', 'SameSite=Strict', 'HttpOnly', 'Secure');
  res.setHeader('set-cookie', a.join('; '));
}

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

// 【新增 A.2】获取 Vercel 真实 IP
function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? String(forwarded).split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown');
}

// 【新增 A.2】速率限制辅助函数
// action: 'login', 'send_code', etc.
// identifier: ip, email, etc.
// limit: max requests
// window: window in seconds
async function rateLimit(action, identifier, limit = 10, window = 60) {
  if (identifier === 'unknown') {
    // 不要对未知 IP 进行速率限制，而是直接拒绝（或通过）
    // 这里选择宽松通过，但记录日志
    console.warn('Rate limit on unknown identifier for action:', action);
    return; // 或者
    // throw new Error('Cannot verify request source');
  }
  const key = `rl:${action}:${identifier}`;
  const count = await redis('incr', key);
  
  if (count === 1) {
    // 第一次请求，设置过期时间
    await redis('expire', key, window);
  }
  
  if (count > limit) {
    // 超出限制
    throw new Error('Too many requests');
  }
}

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function uid(){ return crypto.randomBytes(16).toString('hex'); }
function genSalt(){ return crypto.randomBytes(16).toString('hex'); }
function genVerifyCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendVerificationEmail(toEmail, code, subject = '您的验证码') {
  if (!resend || !EMAIL_FROM) {
    console.error('RESEND_API_KEY 或 EMAIL_FROM 未在环境变量中配置');
    if (process.env.VERCEL_ENV !== 'production') {
      console.log(`=== 邮件模拟发送 (服务未配置) ===`);
      console.log(`TO: ${toEmail}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`CODE: ${code}`);
      console.log(`=================================`);
      return; 
    }
    throw new Error('邮件服务未正确配置');
  }
  
  try {
    // 【修改 D】添加幂等键
    await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: subject,
      html: `<p>您的验证码是：<b>${code}</b></p><p>该验证码10分钟内有效。</p>`,
      headers: {
        // Resend 幂等键
        'X-Entity-Request-Id': crypto.randomUUID(),
      }
    });
  } catch (error) {
    console.error('Resend 邮件发送失败:', error);
    throw new Error('邮件发送失败，请稍后重试');
  }
}

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

async function createSession(res, uid) {
  // 【修改 B.1】使用完全随机的 SID
  const sid = crypto.randomBytes(32).toString('hex');
  // SID 键 (sess:...) 存储 uid
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

module.exports = {
  json, readBody, parseCookies, setCookie,
  redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser, createSession, getUserIdBySession,
  TTL: TTL_DAYS, destroySession,
  
  genVerifyCode,
  sendVerificationEmail,
  VERIFY_CODE_TTL_SECONDS,
  
  // 【新增 A.2】导出速率限制模块
  getIp,
  rateLimit,
};