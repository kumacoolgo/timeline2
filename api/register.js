const { json, readBody, createUser, checkRateLimit } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  if (!await checkRateLimit(req)) return json(res, { error: '请求过于频繁' }, 429);

  const body = await readBody(req);
  const email = (body?.email || '').trim();
  const password = String(body?.password || '');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email) || password.length < 8) {
    return json(res, { error: '请提供有效邮箱与≥8位密码' }, 400);
  }
  const { error, user } = await createUser(email, password);
  if (error) return json(res, { error }, 400);
  return json(res, { ok: true, uid: user.uid });
};
