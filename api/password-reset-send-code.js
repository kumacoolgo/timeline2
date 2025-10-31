// api/password-reset-send-code.js
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS, getIp, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  const ip = getIp(req);
  let email = ''; // 在 try/catch 外部声明

  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    const body = await readBody(req);
    email = normEmail(body?.email || '');

    // 【新增 A.2】速率限制：
    // 1. 同一 IP，1小时内最多发送 5 次
    // 2. 同一 Email，1小时内最多发送 5 次
    await Promise.all([
      rateLimit('send_code_ip', ip, 5, 60 * 60),
      rateLimit('send_code_email', email, 5, 60 * 60)
    ]);
    
    if (!email) {
      return json(res, { error: '请输入邮箱地址' }, 400);
    }

    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
      return json(res, { error: '该邮箱未注册' }, 400);
    }

    const code = genVerifyCode();
    const key = `verify:reset:${email}`;
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    try {
      await sendVerificationEmail(email, code, '重置密码 - 您的验证码');
    } catch (e) {
      return json(res, { error: e.message || '验证码发送失败' }, 500);
    }

    return json(res, { ok: true, message: '验证码已发送，10分钟内有效' });

  } catch (e) {
    if (e.message === 'Too many requests') {
      return json(res, { error: e.message }, 429);
    }
    return json(res, { error: e.message || String(e) }, 500);
  }
};