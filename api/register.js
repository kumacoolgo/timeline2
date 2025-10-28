const { json, readBody, createUser } = require('./_utils');

module.exports = async (req, res)=>{
  if(req.method!=='POST') return json(res, { error:'Method Not Allowed' }, 405);
  try{
    const { email, password } = await readBody(req);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!re.test(String(email||'')) || String(password||'').length<8){
      return json(res, { error:'请提供有效邮箱与≥8位密码' }, 400);
    }
    const out = await createUser(email, password);
    if(out.error==='exists') return json(res,{error:'邮箱已存在'},400);
    return json(res, { ok:true });
  }catch(e){
    return json(res, { error:String(e.message||e) }, 500);
  }
};
