const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit');
const { json, normEmail, getUserByEmail, genSalt, hashPassword, redis, redisPipeline } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);
  const { email:em, code, newPassword } = req.body || {};
  const email = normEmail(em || '');
  if (!email || !code || !newPassword) return json(res, { error:'缺少参数' }, 400);
  if (String(newPassword).length < 10) return json(res, { error:'新密码必须≥10位' }, 400);

  const key = `verify:reset:${email}`;
  const stored = await redis('get', key);
  if (!stored) return json(res, { error:'验证码已过期，请重新发送' }, 400);
  if (stored !== String(code)) return json(res, { error:'验证码错误' }, 400);

  const user = await getUserByEmail(email);
  if (!user) return json(res, { error:'验证码错误' }, 400);

  const salt = genSalt();
  const hash = hashPassword(newPassword, salt);
  user.salt = salt; user.hash = hash;

  await redisPipeline([
    ['set', `user:email:${email}`, JSON.stringify(user)],
    ['del', key]
  ]);

  return json(res, { ok:true, message:'密码重置成功' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitAuthLogin
});
