const { json, readBody, setCookie, createUser, createSession } = require('./_utils');


module.exports = async (req, res) => {
if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
const body = await readBody(req);
const email = (body?.email || '').trim();
const password = String(body?.password || '');
if (!email || password.length < 8) return json(res, { error: '请提供邮箱与≥8位密码' }, 400);


const { error, user } = await createUser(email, password);
if (error) return json(res, { error }, 409);


const sid = await createSession(user.uid);
setCookie(res, 'sid', sid);
json(res, { ok: true, email: user.email });
};