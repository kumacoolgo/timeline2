const { json, readBody, setCookie, getUserByEmail, hashPassword, createSession } = require('./_utils');


module.exports = async (req, res) => {
if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
const body = await readBody(req);
const email = (body?.email || '').trim();
const password = String(body?.password || '');
const user = await getUserByEmail(email);
if (!user) return json(res, { error: '邮箱或密码错误' }, 401);
const hash = hashPassword(password, user.salt);
if (hash !== user.hash) return json(res, { error: '邮箱或密码错误' }, 401);
const sid = await createSession(user.uid);
setCookie(res, 'sid', sid);
json(res, { ok: true, email: user.email });
};