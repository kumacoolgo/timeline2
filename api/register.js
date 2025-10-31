const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit');
const { json, normEmail, createUser, redis } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);
  const body = req.body;
  const email = normEmail(body?.email || ''), code = String(body?.code || ''), password = String(body?.password || '');
  if (!email || !code || !password) return json(res, { error:'缺少参数' }, 400);
  if (password.length < 10) return json(res, { error:'密码必须≥10位' }, 400);
  const key = `verify:reg:${email}`;
  const stored = await redis('get', key);
  if (!stored) return json(res, { error:'验证码已过期，请重新发送' }, 400);
  if (stored !== code) return json(res, { error:'验证码错误' }, 400);
  const { user, error } = await createUser(email, password);
  if (error === 'exists') return json(res, { error:'该邮箱已被注册' }, 400);
  if (error) throw new Error(error);
  await redis('del', key);
  return json(res, { ok:true, message:'注册成功' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitAuthLogin
});
