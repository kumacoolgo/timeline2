const {
  json, readBody, getUserByEmail, verifyPassword, createSession, checkRateLimit
} = require('./_utils');

function normalizeEmail(s = '') {
  return String(s).trim().toLowerCase();
}
function normalizePassword(s = '') {
  return String(s).normalize('NFKC').replace(/^\s+|\s+$/gu, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  if (!await checkRateLimit(req)) return json(res, { error: '请求过于频繁' }, 429);

  const body = await readBody(req);
  const email = normalizeEmail(body?.email || '');
  const rawPw = String(body?.password || '');
  const trimPw = normalizePassword(rawPw);

  const user = await getUserByEmail(email);
  if (!user) {
    return json(res, { error: '邮箱或密码错误', reason: 'user_not_found' }, 400);
  }

  const ok =
    verifyPassword(rawPw, user.hash) ||   // 兼容“旧数据里存了带空格的口令”
    verifyPassword(trimPw, user.hash);    // 新规范化逻辑

  if (!ok) {
    return json(res, { error: '邮箱或密码错误', reason: 'bad_password' }, 400);
  }

  await createSession(res, user.uid);
  return json(res, { ok: true });
};
