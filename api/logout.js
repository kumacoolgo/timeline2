
const { json, destroySession, ensureCsrfCookie, requireCsrf } = require('./_utils');
module.exports = async (req, res) => {
  ensureCsrfCookie(req, res);
  if(req.method!=='POST') return json(res,{error:'Method Not Allowed'},405);
  if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);
  await destroySession(req,res);
  return json(res,{ok:true});
};
