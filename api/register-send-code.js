// api/register-send-code.js
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS } = require('./_utils');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    const body = await readBody(req);
    const email = normEmail(body?.email || '');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return json(res, { error: '请输入有效的邮箱地址' }, 400);
    }

    // 1. 检查邮箱是否已注册
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return json(res, { error: '该邮箱已被注册' }, 400);
    }

    // 2. 生成并存储验证码
    const code = genVerifyCode();
    const key = `verify:reg:${email}`;
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    // 3. 发送邮件
    try {
      await sendVerificationEmail(email, code, '欢迎注册 - 您的验证码');
    } catch (e) {
      return json(res, { error: e.message || '验证码发送失败' }, 500);
    }

    return json(res, { ok: true, message: '验证码已发送，10分钟内有效' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};