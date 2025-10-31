
const { json, readBody, normEmail, getUserByEmail, verifyPassword, createSession, ensureCsrfCookie, requireCsrf, bumpRate, clientIp } = require('./_utils');

module.exports = async (req, res) => {
  try {
    ensureCsrfCookie(req, res); // provide CSRF token cookie always

    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);

    // Basic rate limit by IP + email
    const ip = clientIp(req);
    const body = await readBody(req);
    const email = normEmail(body?.email || ''); 
    const pw = String(body?.password || '');
    if (!email || !pw) return json(res, { error: '缺少参数' }, 400);

    const ipKey = `rl:login:ip:${ip}`;
    const mailKey = `rl:login:mail:${email}`;
    const c1 = await bumpRate(ipKey, 60);
    const c2 = await bumpRate(mailKey, 60);
    if (c1 > 20 || c2 > 10) return json(res, { error: '请求过于频繁，请稍后再试' }, 429);

    // Enforce CSRF
    if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);

    const user = await getUserByEmail(email);
    if (!user) return json(res, { error: '邮箱或密码错误', reason: 'user_not_found' }, 400);

    const ok = verifyPassword(pw, user.hash);
    if (!ok) return json(res, { error: '邮箱或密码错误', reason: 'bad_password' }, 400);

    await createSession(res, user.uid);
    return json(res, { ok: true });
  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
