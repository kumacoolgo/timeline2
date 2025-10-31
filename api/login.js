// api/login.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit');
const { json, readBody, normEmail, getUserByEmail, verifyPassword, createSession } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method Not Allowed' }, 405);
  }
  
  // body 已被 withSecurity/readBodyForSecurity 预读
  const body = req.body; 
  const email = normEmail(body?.email || '');
  const pw = String(body?.password || '');
  
  if (!email || !pw) {
    return json(res, { error: '缺少参数' }, 400);
  }

  const user = await getUserByEmail(email);
  if (!user) {
    // 统一错误信息，防止用户枚举
    return json(res, { error: '邮箱或密码错误' }, 400);
  }

  const ok = verifyPassword(pw, user.hash);
  if (!ok) {
    // 统一错误信息
    return json(res, { error: '邮箱或密码错误' }, 400);
  }

  await createSession(res, user.uid);
  return json(res, { ok: true });
}

module.exports = withSecurity(handler, {
  csrf: true, // 登录需要 CSRF
  allowedOrigins: [process.env.PUBLIC_ORIGIN],
  rateLimit: limitAuthLogin // 按 IP 限登录
});