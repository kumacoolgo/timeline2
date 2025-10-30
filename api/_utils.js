// api/_utils.js
const crypto = require('crypto');
const UPSTASH_REDIS_REST_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const VERIFY_CODE_TTL_SECONDS = 60 * 10; // 验证码10分钟有效期

// --- 【重要】Resend 配置 ---
// 1. 引入 Resend 库
const { Resend } = require('resend');

// 2. 从 Vercel 环境变量中安全地读取 Key 和发件人
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

// 3. 初始化 Resend 客户端
//    如果环境变量没设置，resend 会是 null
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
// --- Resend 配置结束 ---


function json(res, obj, code=200) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
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
  a.push('Path=/', 'SameSite=Lax', 'HttpOnly', 'Secure');
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

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function uid(){ return crypto.randomBytes(16).toString('hex'); }
function genSalt(){ return crypto.randomBytes(16).toString('hex'); }

// 【新增】生成6位随机数字码
function genVerifyCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// 【新增】发送验证邮件 (Resend 真实实现)
async function sendVerificationEmail(toEmail, code, subject = '您的验证码') {
  
  // 检查 Resend 客户端和发件人邮箱是否已在 Vercel 中配置
  // 这会检查 process.env.RESEND_API_KEY 和 process.env.EMAIL_FROM
  if (!resend || !EMAIL_FROM) {
    console.error('RESEND_API_KEY 或 EMAIL_FROM 未在环境变量中配置');
    
    // 在开发环境中，我们回退到打印日志，方便测试
    if (process.env.VERCEL_ENV !== 'production') {
      console.log(`=== 邮件模拟发送 (服务未配置) ===`);
      console.log(`TO: ${toEmail}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`CODE: ${code}`);
      console.log(`=================================`);
      return; // 开发环境假装发送成功
    }
    
    // 生产环境中必须报错
    throw new Error('邮件服务未正确配置');
  }
  
  try {
    // 使用 Resend 发送邮件
    await resend.emails.send({
      from: EMAIL_FROM, // 从 Vercel 环境变量读取的发件人
      to: toEmail,
      subject: subject,
      html: `<p>您的验证码是：<b>${code}</b></p><p>该验证码10分钟内有效。</p>`,
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
  const sid = uid + ':' + crypto.randomBytes(10).toString('hex');
  await redis('setex', `sess:${sid}`, String(TTL_DAYS * 86400), uid); // 全部字符串
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
  
  // 【新增】导出的模块
  genVerifyCode,
  sendVerificationEmail,
  VERIFY_CODE_TTL_SECONDS,
};