// api/items.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitItemsWrite } = require('./_lib/ratelimit');
// 引入 validateItem
const { json, readBody, getUserIdBySession, redis, validateItem } = require('./_utils');

async function handler(req, res, uid) {
  const key = `items:${uid}`;
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const obj = await redis('hgetall', key) || {};
    const arr = Object.values(obj).map(v => { if (!v) return null; try{ return JSON.parse(v); }catch{ return null; }}).filter(Boolean);
    arr.sort((a,b)=>(a.order||0)-(b.order||0));
    return json(res, arr);
  }

  const body = await readBody(req);
  if (req.method === 'POST') {
    const it = body;
    const bad = validateItem(it);
    if (bad) return json(res, { error:'Bad Request: '+bad }, 400);
    it.id = it.id || ('it_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8));
    it.order = it.order || Date.now();
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, it);
  }

  if (req.method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error:'缺少 id' }, 400);
    const oldRaw = await redis('hget', key, id);
    if (!oldRaw) return json(res, { error:'Not Found' }, 404);
    const old = JSON.parse(oldRaw);
    const fresh = { ...old, ...body, id };
    const bad = validateItem(fresh);
    if (bad) return json(res, { error:'Bad Request: '+bad }, 400);
    await redis('hset', key, id, JSON.stringify(fresh));
    return json(res, { ok:true });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error:'缺少 id' }, 400);
    const n = await redis('hdel', key, id);
    if (!n) return json(res, { error:'Not Found' }, 404);
    return json(res, { ok:true });
  }

  return json(res, { error:'Method Not Allowed' }, 405);
}

module.exports = withSecurity(async (req, res) => {
  const { getUserIdBySession } = require('./_utils');
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error:'Unauthorized' }, 401);

  if (['POST','PUT','DELETE'].includes((req.method||'GET').toUpperCase())){
    const ok = await require('./_lib/ratelimit').limitItemsWrite(req, res, uid);
    if (!ok) return;
  }
  return handler(req, res, uid);
}, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean)
});