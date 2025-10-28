const { json, destroySession } = require('./_utils');
module.exports = async (req,res)=>{
  await destroySession(req,res);
  return json(res, { ok:true });
};
