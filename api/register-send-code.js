// api/register-send-code.js
const { json, readBody, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS, getIp, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  const ip = getIp(req);
  let email = '';

  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    const body = await readBody(req);
    email = normEmail(body?.email || '');

    // 【新增 A.2】速率限制 (同 reset)
    await Promise.all([
      rateLimit('send_code_ip', ip, 5, 60 * 60),
      rateLimit('send_code_email', email, 5, 60 * 60)
    ]);
    
    if (!email) {
      return json(res, { error: '请输入邮箱地址' }, 400);
    }

    // 1. 检查邮箱是否 *已* 存在
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return json(res, { error: '该邮箱已被注册' }, 400);
    }

    // 2. 生成并存储验证码
    const code = genVerifyCode();
    const key = `verify:reg:${email}`; // 注册专用key
    await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

    // 3. 发送邮件
    try {
      await sendVerificationEmail(email, code, '注册 - 您的验证码');
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