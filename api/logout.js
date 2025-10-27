const { json, parseCookies, destroySession } = require('./_utils');


module.exports = async (req, res) => {
if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
const c = parseCookies(req); const raw = c['sid'];
if (raw) await destroySession(raw);
res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
json(res, { ok: true });
};