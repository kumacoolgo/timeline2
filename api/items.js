const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error: 'Unauthorized' }, 401);
  const key = `items:${uid}`;

  if (req.method === 'GET') {
    const obj = await redis('hgetall', key) || {};
    const arr = Array.isArray(obj) ? [] : Object.values(obj||{}).map(v=>JSON.parse(v));
    return json(res, arr);
  }

  if (req.method === 'POST') {
    const it = await readBody(req);
    if(!it?.id) return json(res, { error: '缺少 id' }, 400);
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    if(!id) return json(res, { error: '缺少 id' }, 400);
    await redis('hdel', key, id);
    return json(res, { ok: true });
  }

  json(res, { error: 'Method Not Allowed' }, 405);
};
