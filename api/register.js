// api/register.js
const { json, readBody, normEmail, createUser, redis, getIp, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  const ip = getIp(req);

  try {
    // 【新增 A.2】速率限制：1小时内，同一IP最多注册 5 次
    await rateLimit('register', ip, 5, 60 * 60);
  } catch (e) {
    return json(res, { error: e.message }, 429);
  }

  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    
    const body = await readBody(req);
    const email = normEmail(body?.email || '');
    const code = String(body?.code || '');
    const password = String(body?.password || '');

    if (!email || !code || !password) {
      return json(res, { error: '缺少参数' }, 400);
    }
    
    // 【修改 C.2】加强密码策略
    if (password.length < 10) {
      return json(res, { error: '密码必须≥10位' }, 400);
    }

    // 1. 验证验证码
    const key = `verify:reg:${email}`; // 注册专用key
    const storedCode = await redis('get', key);

    if (!storedCode) {
      return json(res, { error: '验证码已过期，请重新发送' }, 400);
    }
    
    if (storedCode !== code) {
      return json(res, { error: '验证码错误' }, 400);
    }
    
    // 2. 创建用户
    const { user, error } = await createUser(email, password);
    
    if (error === 'exists') {
      return json(res, { error: '该邮箱已被注册' }, 400);
    }
    if (error) {
      throw new Error(error);
    }
    
    // 3. 删除验证码
    await redis('del', key);

    return json(res, { ok: true, message: '注册成功' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};