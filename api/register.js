const { json, readBody, createUser, checkRateLimit } = require('./_utils');

function normalizeEmail(s = '') { return String(s).trim().toLowerCase(); }
function normalizePassword(s = '') {
  return String(s).normalize('NFKC').replace(/^\s+|\s+$/gu, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  if (!await checkRateLimit(req)) return json(res, { error: '请求过于频繁' }, 429);

  const body = await readBody(req);
  const email = normalizeEmail(body?.email || '');
  const password = normalizePassword(body?.password || '');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || password.length < 8) {
    return json(res, { error: '请提供有效邮箱与≥8位密码' }, 400);
  }

  const { error, user } = await createUser(email, password);
  if (error) return json(res, { error }, 400);
  return json(res, { ok: true, uid: user.uid });
};
