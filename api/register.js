const { json, readBody, createUser, normEmail } = require('./_utils');
module.exports = async (req,res)=>{
  if(req.method!=='POST') return json(res,{error:'方法不允许'},405);
  const body = await readBody(req);
  const email = normEmail(body?.email||''); const password=String(body?.password||'');
  const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!email || !emailRegex.test(email) || password.length<8) return json(res,{error:'请提供有效邮箱与≥8位密码'},400);
  const r = await createUser(email,password);
  if(r.error==='exists') return json(res,{error:'邮箱已存在'},400);
  return json(res,{ok:true});
};