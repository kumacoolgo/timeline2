const { json, readBody, getUserByEmail, verifyPassword, createSession, setCookie } = require('./_utils');

module.exports = async (req, res)=>{
  if(req.method!=='POST') return json(res, { error:'Method Not Allowed' }, 405);
  try{
    const { email, password } = await readBody(req);
    const user = await getUserByEmail(email);
    if(!user) return json(res, { error:'邮箱或密码错误', reason:'user_not_found' }, 400);
    if(!verifyPassword(password, user.hash)) return json(res, { error:'邮箱或密码错误', reason:'bad_password' }, 400);
    const sid = await createSession(user.uid);
    setCookie(res,'sid', sid, 30);
    return json(res, { ok:true, uid:user.uid, email:user.email });
  }catch(e){
    return json(res, { error: String(e.message||e) }, 500);
  }
};
