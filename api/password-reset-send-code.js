// api/password-reset-send-code.js
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS } = require('./_utils');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    const body = await readBody(req);
    const email = normEmail(body?.email || '');

    if (!email) {
      return json(res, { error: '请输入邮箱地址' }, 400);
    }

    // 1. 检查邮箱是否存在
    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
      // 出于安全考虑，不应明确提示“用户不存在”，但为了前端友好性，这里还是提示了
      return json(res, { error: '该邮箱未注册' }, 400);
    }

    // 2. 生成并存储验证码
    const code = genVerifyCode();
    const key = `verify:reset:${email}`;
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    // 3. 发送邮件
    try {
      await sendVerificationEmail(email, code, '重置密码 - 您的验证码');
    } catch (e) {
      return json(res, { error: e.message || '验证码发送失败' }, 500);
    }

    return json(res, { ok: true, message: '验证码已发送，10分钟内有效' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};