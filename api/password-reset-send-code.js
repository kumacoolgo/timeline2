// api/password-reset-send-code.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthSendCode } = require('./_lib/ratelimit');
const { json, normEmail, getUserByEmail, genVerifyCode, sendVerificationEmail, redis, VERIFY_CODE_TTL_SECONDS } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method Not Allowed' }, 405);
  }
  
  const email = normEmail(req.body?.email || '');
  if (!email) {
    return json(res, { error: '请输入邮箱地址' }, 400);
  }

  const existingUser = await getUserByEmail(email);
  if (!existingUser) {
    // 统一提示，防止枚举
    return json(res, { error: '如果邮箱已注册，您将收到一封邮件' }, 200);
  }

  const code = genVerifyCode();
  const key = `verify:reset:${email}`;
  await redis('setex', key, VERIFY_CODE_TTL_SECONDS, code);

  try {
    await sendVerificationEmail(email, code, '重置密码 - 您的验证码');
  } catch (e) {
    return json(res, { error: '验证码发送失败，请稍后重试' }, 500);
  }

  return json(res, { ok: true, message: '如果邮箱已注册，您将收到一封邮件' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN],
  rateLimit: limitAuthSendCode // 邮箱+IP 组合限流
});