const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res)=>{
  const uid = await getUserIdBySession(req);
  if(!uid) return json(res, { error:'Unauthorized' }, 401);
  const key = `items:${uid}`;

  if(req.method==='GET'){
    const obj = await redis('hgetall', key);
    let arr=[];
    if(obj && typeof obj==='object'){
      for(const k of Object.keys(obj)){
        try{ arr.push(JSON.parse(obj[k])) }catch{}
      }
    }
    return json(res, arr);
  }
  if(req.method==='POST'){
    const it = await readBody(req);
    it.id = it.id || ('it_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7));
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, it);
  }
  if(req.method==='PUT'){
    const url = new URL(req.url, 'http://local');
    const id = url.searchParams.get('id');
    if(!id) return json(res, { error:'缺少 id' }, 400);
    const old = await redis('hget', key, id);
    if(!old) return json(res, { error:'Not Found' }, 404);
    const body = await readBody(req);
    const merged = { ...JSON.parse(old), ...body, id };
    await redis('hset', key, id, JSON.stringify(merged));
    return json(res, { ok:true });
  }
  if(req.method==='DELETE'){
    const url = new URL(req.url, 'http://local');
    const id = url.searchParams.get('id');
    if(!id) return json(res, { error:'缺少 id' }, 400);
    await redis('hdel', key, id);
    return json(res, { ok:true });
  }
  return json(res, { error:'Method Not Allowed' }, 405);
};
