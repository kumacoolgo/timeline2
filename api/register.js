const { withSecurity } = require('./_lib/withSecurity');
const { limitAuthLogin } = require('./_lib/ratelimit'); // 使用严格限流
const { json, normEmail, createUser, redis } = require('./_utils');

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);

  const body = req.body;
  const email = normEmail(body?.email || ''), code = String(body?.code || ''), password = String(body?.password || '');

  if (!email || !code || !password) return json(res, { error:'缺少参数' }, 400);
  
  // --- 安全修改：错误信息模糊化 ---
  // 原文：if (password.length < 10) return json(res, { error:'密码必须≥10位' }, 400);
  if (password.length < 10) return json(res, { error:'注册失败：请检查输入' }, 400);

  const key = `verify:reg:${email}`;
  const stored = await redis('get', key);
  if (!stored) return json(res, { error:'验证码已过期，请重新发送' }, 400);
  if (stored !== code) return json(res, { error:'验证码错误' }, 400);

  const { user, error } = await createUser(email, password);
  
  // --- 安全修改：隐藏“邮箱已存在”的事实 ---
  // 即使邮箱已存在，也返回模糊错误，或者在前端流程上不予提示（视业务取舍）。
  // 鉴于注册流程通常需要反馈，这里建议用一个看起来像校验失败的通用词，或者保持"无法完成注册"
  if (error === 'exists') return json(res, { error:'注册失败：无法完成操作' }, 400);
  
  if (error) throw new Error(error);
  
  await redis('del', key);
  return json(res, { ok:true, message:'注册成功' });
}

module.exports = withSecurity(handler, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitAuthLogin
});