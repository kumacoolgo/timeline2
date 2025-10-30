// api/register.js
const { json, readBody, createUser, normEmail, redis } = require('./_utils');

module.exports = async (req,res)=>{
  try {
    if(req.method!=='POST') return json(res,{error:'Method Not Allowed'},405);
    
    const body = await readBody(req);
    const email = normEmail(body?.email||'');
    const password = String(body?.password||'');
    const code = String(body?.code || ''); // 【新增】获取验证码

    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!email || !emailRegex.test(email) || password.length < 8) {
      return json(res,{error:'请提供有效邮箱与≥8位密码'},400);
    }
    
    // 【新增】验证验证码
    if (!code) {
      return json(res, { error: '请输入验证码' }, 400);
    }
    
    const key = `verify:reg:${email}`;
    const storedCode = await redis('get', key);
    
    if (!storedCode) {
      return json(res, { error: '验证码已过期，请重新发送' }, 400);
    }
    
    if (storedCode !== code) {
      return json(res, { error: '验证码错误' }, 400);
    }
    
    // 验证通过，创建用户
    const r = await createUser(email, password);
    if(r.error==='exists') return json(res,{error:'邮箱已存在'},400); // (兜底检查)
    
    // 【新增】删除已使用的验证码
    await redis('del', key);

    return json(res,{ok:true});

  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};