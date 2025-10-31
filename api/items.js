// api/items.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitItemsWrite } = require('./_lib/ratelimit');
const { json, readBody, getUserIdBySession, redis } = require('./_utils');

// 内部 handler，此时已通过安全校验
async function handler(req, res, uid) {
  const key = `items:${uid}`;
  const url = new URL(req.url, 'http://x');
  
  if (req.method === 'GET') {
    const obj = await redis('hgetall', key) || {};
    const arr = Object.values(obj).map(v => {
      if (!v) return null;
      try { return JSON.parse(v); } catch (e) {
        console.error('Corrupted item in Redis, skipping:', v, e.message);
        return null;
      }
    }).filter(Boolean);
    arr.sort((a, b) => (a.order || 0) - (b.order || 0));
    return json(res, arr);
  }

  // 以下都是写操作
  const body = await readBody(req);

  if (req.method === 'POST') {
    const it = body;
    it.id = it.id || ('it_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    it.order = it.order || Date.now();
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, it);
  }

  if (req.method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error: '缺少 id' }, 400);
    const oldRaw = await redis('hget', key, id);
    if (!oldRaw) return json(res, { error: 'Not Found' }, 404);
    const old = JSON.parse(oldRaw);
    const fresh = { ...old, ...body, id };
    await redis('hset', key, id, JSON.stringify(fresh));
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error: '缺少 id' }, 400);
    const n = await redis('hdel', key, id);
    if (!n) return json(res, { error: 'Not Found' }, 404);
    return json(res, { ok: true });
  }
  
  return json(res, { error: 'Method Not Allowed' }, 405);
}

// 包装器
module.exports = withSecurity(async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) {
    return json(res, { error: 'Unauthorized' }, 401);
  }
  
  // 对写操作应用“按用户”限流
  if (['POST', 'PUT', 'DELETE'].includes((req.method || '').toUpperCase())) {
    const ok = await limitItemsWrite(req, res, uid);
    if (!ok) return; // 已 429
  }
  
  // 注入 uid 并调用内部 handler
  return handler(req, res, uid);
}, {
  csrf: true, // 所有操作都需要 CSRF
  allowedOrigins: [process.env.PUBLIC_ORIGIN]
});