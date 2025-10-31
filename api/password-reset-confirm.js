// api/password-reset-confirm.js
const { json, readBody, normEmail, getUserByEmail, genSalt, hashPassword, redis, redisPipeline, getIp, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  const ip = getIp(req);

  try {
    // 【新增 A.2】速率限制：15分钟内，同一IP最多尝试 5 次
    await rateLimit('reset_confirm', ip, 5, 60 * 15);
  } catch (e) {
    return json(res, { error: e.message }, 429);
  }

  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    
    const body = await readBody(req);
    const email = normEmail(body?.email || '');
    const code = String(body?.code || '');
    const newPassword = String(body?.newPassword || '');

    if (!email || !code || !newPassword) {
      return json(res, { error: '缺少参数' }, 400);
    }
    
    // 【修改 C.2】加强密码策略
    if (newPassword.length < 10) {
      return json(res, { error: '新密码必须≥10位' }, 400);
    }

    const key = `verify:reset:${email}`;
    const storedCode = await redis('get', key);

    if (!storedCode) {
      return json(res, { error: '验证码已过期，请重新发送' }, 400);
    }
    
    if (storedCode !== code) {
      return json(res, { error: '验证码错误' }, 400);
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return json(res, { error: '用户不存在' }, 404);
    }
    
    const salt = genSalt();
    const hash = hashPassword(newPassword, salt);
    
    user.salt = salt;
    user.hash = hash;
    
    const userKey = `user:email:${email}`;
    
    await redisPipeline([
      ['set', userKey, JSON.stringify(user)],
      ['del', key]
    ]);

    return json(res, { ok: true, message: '密码重置成功' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};