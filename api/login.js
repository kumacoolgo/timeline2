// api/login.js
const { json, readBody, normEmail, getUserByEmail, verifyPassword, createSession, getIp, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  const ip = getIp(req);
  
  try {
    // 【新增 A.2】速率限制：10分钟内，同一IP最多尝试 10 次
    await rateLimit('login', ip, 10, 60 * 10);
  } catch (e) {
    return json(res, { error: e.message }, 429); // 429 Too Many Requests
  }

  try {
    if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
    const body = await readBody(req);
    const email = normEmail(body?.email || ''); 
    const pw = String(body?.password || '');
    if (!email || !pw) return json(res, { error: '缺少参数' }, 400);

    const user = await getUserByEmail(email);
    if (!user) return json(res, { error: '邮箱或密码错误', reason: 'user_not_found' }, 400);

    const ok = verifyPassword(pw, user.hash);
    if (!ok) return json(res, { error: '邮箱或密码错误', reason: 'bad_password' }, 400);

    await createSession(res, user.uid);
    return json(res, { ok: true });
  } catch (e) {
    // 防止 500 吞掉具体原因
    return json(res, { error: e.message || String(e) }, 500);
  }
};