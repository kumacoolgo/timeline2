const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit');
const { json, normEmail, getUserByEmail, verifyPassword, createSession } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);
  const body = req.body;
  const email = normEmail(body?.email || ''), pw = String(body?.password || '');
  if (!email || !pw) return json(res, { error:'缺少参数' }, 400);
  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(pw, user.hash)) return json(res, { error:'邮箱或密码错误' }, 400);
  await createSession(res, user.uid);
  return json(res, { ok:true });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitAuthLogin
});
