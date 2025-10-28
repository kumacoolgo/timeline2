const {
  json, readBody, normEmail,
  getUserByEmail, verifyPassword, createSession
} = require('./_utils');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, { error: '方法不允许' }, 405);

    const body = await readBody(req);
    const email = normEmail(body?.email || '');
    const pw = String(body?.password || '');
    if (!email || !pw) return json(res, { error: '缺少参数' }, 400);

    const user = await getUserByEmail(email); // ← 现在走兼容版读取
    if (!user) return json(res, { error: '邮箱或密码错误', reason: 'user_not_found' }, 400);

    const ok = verifyPassword(pw, user.hash);
    if (!ok) return json(res, { error: '邮箱或密码错误', reason: 'bad_password' }, 400);

    await createSession(res, user.uid);
    return json(res, { ok: true });
  } catch (e) {
    console.error('login failed:', e);
    return json(res, { error: 'server_error' }, 500);
  }
};
