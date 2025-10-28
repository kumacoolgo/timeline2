const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if(!uid) return json(res,{error:'未登录'},401);
  const key = `items:${uid}`;

  if(req.method==='GET'){
    const obj = await redis('hgetall', key) || {};
    const arr = Object.values(obj).map(v=>JSON.parse(v));
    return json(res, arr);
  }
  if(req.method==='POST'){
    const it = await readBody(req);
    it.id = it.id || ('it_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, it);
  }
  if(req.method==='PUT'){
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if(!id) return json(res,{error:'缺少 id'},400);
    const oldRaw = await redis('hget', key, id);
    if(!oldRaw) return json(res,{error:'Not Found'},404);
    const old = JSON.parse(oldRaw);
    const body = await readBody(req);
    const fresh = { ...old, ...body, id };
    await redis('hset', key, id, JSON.stringify(fresh));
    return json(res,{ok:true});
  }
  if(req.method==='DELETE'){
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if(!id) return json(res,{error:'缺少 id'},400);
    const n = await redis('hdel', key, id);
    if(!n) return json(res,{error:'Not Found'},404);
    return json(res,{ok:true});
  }
  return json(res,{error:'方法不允许'},405);
};