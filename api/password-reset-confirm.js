// api/password-reset-confirm.js
const { json, readBody, normEmail, getUserByEmail, genSalt, hashPassword, redis, redisPipeline } = require('./_utils');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    
    const body = await readBody(req);
    const email = normEmail(body?.email || '');
    const code = String(body?.code || '');
    const newPassword = String(body?.newPassword || '');

    if (!email || !code || !newPassword) {
      return json(res, { error: '缺少参数' }, 400);
    }
    
    if (newPassword.length < 8) {
      return json(res, { error: '新密码必须≥8位' }, 400);
    }

    // 1. 验证验证码
    const key = `verify:reset:${email}`;
    const storedCode = await redis('get', key);

    if (!storedCode) {
      return json(res, { error: '验证码已过期，请重新发送' }, 400);
    }
    
    if (storedCode !== code) {
      return json(res, { error: '验证码错误' }, 400);
    }
    
    // 2. 验证用户
    const user = await getUserByEmail(email);
    if (!user) {
      return json(res, { error: '用户不存在' }, 404);
    }
    
    // 3. 更新密码
    const salt = genSalt();
    const hash = hashPassword(newPassword, salt);
    
    // 更新 user 对象
    user.salt = salt;
    user.hash = hash;
    
    const userKey = `user:email:${email}`;
    
    await redisPipeline([
      // 更新用户信息
      ['set', userKey, JSON.stringify(user)],
      // 删除已用的验证码
      ['del', key]
    ]);

    return json(res, { ok: true, message: '密码重置成功' });

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};