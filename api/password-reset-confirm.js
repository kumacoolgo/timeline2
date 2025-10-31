// api/password-reset-confirm.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit'); // 复用登录IP限流
const { json, normEmail, getUserByEmail, genSalt, hashPassword, redis, redisPipeline } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method Not Allowed' }, 405);
  }

  const body = req.body;
  const email = normEmail(body?.email || '');
  const code = String(body?.code || '');
  const newPassword = String(body?.newPassword || '');

  if (!email || !code || !newPassword) {
    return json(res, { error: '缺少参数' }, 400);
  }
  if (newPassword.length < 10) { // 强化密码策略
    return json(res, { error: '新密码必须≥10位' }, 400);
  }

  const key = `verify:reset:${email}`;
  const storedCode = await redis('get', key);

  if (!storedCode) {
    return json(res, { error: '验证码已过期，请重新发送' }, 400);
  }
  if (storedCode !== code) {
    return json(res, { error: '验证码错误' }, 400);
  }
  
  const user = await getUserByEmail(email);
  if (!user) {
    return json(res, { error: '验证码错误' }, 400); // 统一提示
  }
  
  const salt = genSalt();
  const hash = hashPassword(newPassword, salt);
  user.salt = salt;
  user.hash = hash;
  
  await redisPipeline([
    ['set', `user:email:${email}`, JSON.stringify(user)],
    ['del', key]
  ]);

  return json(res, { ok: true, message: '密码重置成功' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN],
  rateLimit: limitAuthLogin // 确认步骤，复用登录的IP限流
});