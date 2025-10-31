
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS, ensureCsrfCookie, requireCsrf, bumpRate, clientIp } = require('./_utils');

module.exports = async (req, res) => {
  try {
    ensureCsrfCookie(req, res);
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);

    const body = await readBody(req);
    const email = normEmail(body?.email || '');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return json(res, { error: '请输入有效的邮箱地址' }, 400);
    }

    // Rate limit by IP and email
    const ip = clientIp(req);
    const ipKey = `rl:send:ip:${ip}`;
    const mailKey = `rl:send:mail:${email}`;
    const c1 = await bumpRate(ipKey, 60);
    const c2 = await bumpRate(mailKey, 60);
    if (c1 > 10 || c2 > 5) return json(res, { error: '请求过于频繁，请稍后再试' }, 429);

    const existingUser = await getUserByEmail(email);
    if (existingUser) return json(res, { error: '该邮箱已被注册' }, 400);

    const code = genVerifyCode();
    const key = `verify:reg:${email}`;
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    await sendVerificationEmail(email, code, '欢迎注册 - 您的验证码');
    return json(res, { ok: true, message: '验证码已发送，10分钟内有效' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
