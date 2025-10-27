const { json, readBody, setCookie, getUserByEmail, hashPassword, createSession } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  const body = await readBody(req);
  const email = String(body?.email||'').trim().toLowerCase();
  const password = String(body?.password||'');
  if (!email || password.length < 8) return json(res, { error: '邮箱/密码无效' }, 400);

  const u = await getUserByEmail(email);
  if (!u) return json(res, { error: '账号或密码错误' }, 400);
  const hash = hashPassword(password, u.salt);
  if (hash !== u.hash) return json(res, { error: '账号或密码错误' }, 400);

  const sid = await createSession(u.uid);
  setCookie(res, 'sid', sid);
  return json(res, { ok: true, uid: u.uid });
};
