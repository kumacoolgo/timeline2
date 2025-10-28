const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error: 'Unauthorized' }, 401);
  const key = `items:${uid}`;

  if (req.method === 'GET') {
    const obj = await redis('HGETALL', key) || {};
    const arr = Object.values(obj).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    arr.sort((a,b)=> (a.sort??0)-(b.sort??0) || (a.createdAt??0)-(b.createdAt??0));
    return json(res, arr);
  }

  if (req.method === 'POST') {
    const it = await readBody(req);
    it.id = it.id || ('it_' + Date.now().toString(36)+Math.random().toString(36).slice(2,8));
    if (typeof it.sort !== 'number') it.sort = Math.floor(Date.now()/1000);
    if (typeof it.createdAt !== 'number') it.createdAt = Date.now();
    await redis('HSET', key, it.id, JSON.stringify(it));
    return json(res, { ok: true, id: it.id });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://local');
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error: '缺少 id' }, 400);
    const r = await redis('HDEL', key, id);
    if (r === 0) return json(res, { error: 'Not Found' }, 404);
    return json(res, { ok: true });
  }

  return json(res, { error: 'Method Not Allowed' }, 405);
};
