const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error: 'Unauthorized' }, 401);
  const key = `items:${uid}`;

  if (req.method === 'GET') {
    let arr = [];
    try {
      const raw = await redis('HGETALL', key);
      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i += 2) {
          try { arr.push(JSON.parse(raw[i+1])); } catch {}
        }
      } else if (raw && typeof raw === 'object') {
        arr = Object.values(raw).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
      }
    } catch (e) {
      // 兼容旧版（String 大数组）→ 一次性迁移到 Hash
      try {
        const legacy = await redis('GET', key);
        if (legacy) {
          const legacyArr = JSON.parse(legacy);
          await redis('DEL', key);
          for (const it of legacyArr) {
            if (!it.id) it.id = (Date.now().toString(36)+Math.random().toString(36).slice(2,8));
            if (!it.createdAt) it.createdAt = Date.now();
            await redis('HSET', key, it.id, JSON.stringify(it));
          }
          arr = legacyArr;
        } else {
          throw e;
        }
      } catch (_) {
        throw e;
      }
    }
    arr.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    return json(res, arr);
  }

  if (req.method === 'POST') {
    const it = await readBody(req);
    it.id = it.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,8));
    if (!it.createdAt) it.createdAt = Date.now();
    await redis('HSET', key, it.id, JSON.stringify(it));
    return json(res, it);
  }

  if (req.method === 'PUT') {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error: '缺少 id' }, 400);
    const patch = await readBody(req);
    const oldRaw = await redis('HGET', key, id);
    if (!oldRaw) return json(res, { error: 'Not Found' }, 404);
    const oldItem = JSON.parse(oldRaw);
    const newItem = { ...oldItem, ...patch, id };
    await redis('HSET', key, id, JSON.stringify(newItem));
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error: '缺少 id' }, 400);
    const r = await redis('HDEL', key, id);
    if (r === 0) return json(res, { error: 'Not Found' }, 404);
    return json(res, { ok: true });
  }

  return json(res, { error: 'Method Not Allowed' }, 405);
};
