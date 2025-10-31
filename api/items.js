// api/items.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitItemsWrite } = require('./_lib/ratelimit');
const { json, readBody, getUserIdBySession, redis } = require('./_utils');

function validateItem(it){
  const typeOk = ['plan','warranty','insurance'].includes(it.type);
  if (!typeOk) return 'type';
  if (!it.name || it.name.length > 100) return 'name';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.startDate || '')) return 'startDate';
  if (it.currency && !/^[A-Z]{3}$/.test(it.currency)) return 'currency';

  // optional fields
  if (it.category && it.category.length>50) return 'category';
  if (it.tags && !Array.isArray(it.tags)) return 'tags';
  if (Array.isArray(it.tags) && it.tags.length>50) return 'tags_too_many';

  if (it.type !== 'warranty') {
    const bd = Number(it.billingDay);
    if (Number.isNaN(bd) || bd < 1 || bd > 28) return 'billingDay';
    if (Array.isArray(it.pricePhases)) {
      if (it.pricePhases.length > 200) return 'pricePhases_too_long';
      for (const p of it.pricePhases) {
        if (p.fromMonth < 1 || p.fromMonth > 1200) return 'pricePhases_fromMonth';
        if (p.amount < 0 || p.amount > 1e12) return 'pricePhases_amount';
      }
    }
    if (Array.isArray(it.cancelWindows)) {
      if (it.cancelWindows.length > 200) return 'cancelWindows_too_long';
      for (const w of it.cancelWindows) {
        if (w.fromMonth < 1 || w.toMonth < w.fromMonth || w.toMonth > 1200) return 'cancelWindows_range';
      }
    }
    // insurance policy term
    if (it.type==='insurance'){
      const y = Number(it.policyTermYears||0), m = Number(it.policyTermMonths||0);
      if (y<0 || y>120) return 'policyTermYears';
      if (m<0 || m>11) return 'policyTermMonths';
    }
  } else {
    const wm = Number(it.warrantyMonths||0);
    if (wm < 0 || wm > 1200) return 'warrantyMonths';
  }
  return null;
}

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
    const bad = validateItem(it); if (bad) return json(res, { error:'Bad Request: '+bad }, 400);
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
    const bad = validateItem(fresh); if (bad) return json(res, { error:'Bad Request: '+bad }, 400);
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
