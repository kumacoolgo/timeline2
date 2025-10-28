// api/register.js
const { json, readBody, createUser } = require('./_utils');

module.exports = async (req, res) => {
  if(req.method!=='POST') return json(res,{error:'Method Not Allowed'},405);
  const body = await readBody(req);
  const email = String(body?.email||'').trim();
  const password = String(body?.password||'');
  const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!emailRegex.test(email) || password.length<8) return json(res,{error:'请提供有效邮箱与≥8位密码'},400);
  const r = await createUser(email,password);
  if(r.error) return json(res,{error:r.error},400);
  return json(res,{ok:true});
};
