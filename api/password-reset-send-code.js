
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS, ensureCsrfCookie, requireCsrf, bumpRate, clientIp } = require('./_utils');

module.exports = async (req, res) => {
  try {
    ensureCsrfCookie(req, res);
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);

    const body = await readBody(req);
    const email = normEmail(body?.email || '');

    if (!email) return json(res, { error: '请输入邮箱地址' }, 400);

    // Rate limit
    const ip = clientIp(req);
    const ipKey = `rl:reset:ip:${ip}`;
    const mailKey = `rl:reset:mail:${email}`;
    const c1 = await bumpRate(ipKey, 60);
    const c2 = await bumpRate(mailKey, 60);
    if (c1 > 10 || c2 > 5) return json(res, { error: '请求过于频繁，请稍后再试' }, 429);

    const existingUser = await getUserByEmail(email);
    if (!existingUser) return json(res, { error: '该邮箱未注册' }, 400);

    const code = genVerifyCode();
    const key = `verify:reset:${email}`;
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    await sendVerificationEmail(email, code, '重置密码 - 您的验证码');
    return json(res, { ok: true, message: '验证码已发送，10分钟内有效' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
