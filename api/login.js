// api/login.js
const { json, readBody, getUserByEmail, hashPassword, createSession } = require('./_utils');

module.exports = async (req, res) => {
  if(req.method!=='POST') return json(res,{error:'Method Not Allowed'},405);
  const body = await readBody(req);
  const email = String(body?.email||'').trim();
  const password = String(body?.password||'');
  if(!email || !password) return json(res,{error:'邮箱或密码错误'},400);

  const user = await getUserByEmail(email);
  if(!user) return json(res,{error:'邮箱或密码错误', reason:'user_not_found'},400);

  const h = hashPassword(password, user.salt);
  if(h!==user.hash) return json(res,{error:'邮箱或密码错误'},400);

  await createSession(res, user.uid);
  return json(res,{ok:true, uid:user.uid});
};
