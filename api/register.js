
const { json, readBody, createUser, normEmail, redis, ensureCsrfCookie, requireCsrf } = require('./_utils');

module.exports = async (req,res)=>{
  try {
    ensureCsrfCookie(req, res);
    if(req.method!=='POST') return json(res,{error:'Method Not Allowed'},405);
    if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);
    
    const body = await readBody(req);
    const email = normEmail(body?.email||'');
    const password = String(body?.password||'');
    const code = String(body?.code || '');

    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!email || !emailRegex.test(email) || password.length < 8) {
      return json(res,{error:'请提供有效邮箱与≥8位密码'},400);
    }
    if (!code) return json(res, { error: '请输入验证码' }, 400);
    
    const key = `verify:reg:${email}`;
    const storedCode = await redis('get', key);
    if (!storedCode) return json(res, { error: '验证码已过期，请重新发送' }, 400);
    if (storedCode !== code) return json(res, { error: '验证码错误' }, 400);
    
    const r = await createUser(email, password);
    if(r.error==='exists') return json(res,{error:'邮箱已存在'},400);
    
    await redis('del', key);
    return json(res,{ok:true});
  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
