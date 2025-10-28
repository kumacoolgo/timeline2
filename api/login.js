const {
  json, readBody, getUserByEmail, verifyPassword, createSession, checkRateLimit
} = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  if (!await checkRateLimit(req)) return json(res, { error: '请求过于频繁' }, 429);

  const body = await readBody(req);
  const email = (body?.email || '').trim().toLowerCase();
  // 登录：两种尝试（兼容以前已存入“含空格”的口令）
  const rawPw   = String(body?.password || '');
  const trimPw  = rawPw.trim();

  const user = await getUserByEmail(email);
  if (!user) return json(res, { error: '邮箱或密码错误' }, 400);

  const ok = verifyPassword(rawPw, user.hash) || verifyPassword(trimPw, user.hash);
  if (!ok) return json(res, { error: '邮箱或密码错误' }, 400);

  await createSession(res, user.uid);
  return json(res, { ok: true });
};
