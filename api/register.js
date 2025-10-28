const { json, readBody, createUser } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  const { email, password } = await readBody(req);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || String(password||'').length < 8) {
    return json(res, { error: '请提供有效邮箱与≥8位密码' }, 400);
  }
  const { error } = await createUser(email, password);
  if (error) return json(res, { error }, 400);
  json(res, { ok: true });
};
