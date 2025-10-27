const { json, parseCookies, destroySession } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  const sid = parseCookies(req)['sid'];
  if (sid) await destroySession(sid);
  // 覆盖 cookie
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  if (process.env.VERCEL_URL) res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');
  return json(res, { ok: true });
};
