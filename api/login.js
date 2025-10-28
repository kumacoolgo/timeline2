const { json, readBody, getUserByEmail, verifyPassword, createSession } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  const { email, password } = await readBody(req);
  if (!email || !password) return json(res, { error: '缺少邮箱或密码' }, 400);

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.hash)) {
    return json(res, { error: '邮箱或密码错误' }, 400);
  }
  await createSession(res, user.uid);
  json(res, { ok: true, uid: user.uid });
};
