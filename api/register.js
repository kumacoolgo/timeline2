// api/register.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit'); // 复用登录IP限流
const { json, normEmail, createUser, redis } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method Not Allowed' }, 405);
  }

  const body = req.body;
  const email = normEmail(body?.email || '');
  const code = String(body?.code || '');
  const password = String(body?.password || '');

  if (!email || !code || !password) {
    return json(res, { error: '缺少参数' }, 400);
  }
  
  if (password.length < 10) { // 强化密码策略
    return json(res, { error: '密码必须≥10位' }, 400);
  }

  const key = `verify:reg:${email}`;
  const storedCode = await redis('get', key);

  if (!storedCode) {
    return json(res, { error: '验证码已过期，请重新发送' }, 400);
  }
  if (storedCode !== code) {
    return json(res, { error: '验证码错误' }, 400);
  }
  
  const { user, error } = await createUser(email, password);
  
  if (error === 'exists') {
    return json(res, { error: '该邮箱已被注册' }, 400);
  }
  if (error) {
    throw new Error(error); // 抛给 withSecurity 统一处理
  }
  
  await redis('del', key);
  return json(res, { ok: true, message: '注册成功' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN],
  rateLimit: limitAuthLogin // 确认步骤，复用登录的IP限流
});