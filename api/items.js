const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error:'Unauthorized' }, 401);
  const key = `items:${uid}`;

  if (req.method === 'GET') {
    const obj = await redis('hgetall', key) || {};
    let arr = [];
    if (Array.isArray(obj)) {
      for (let i=0;i<obj.length;i+=2) arr.push(JSON.parse(obj[i+1]));
    } else {
      arr = Object.values(obj).map(x=>JSON.parse(x));
    }
    return json(res, arr);
  }
  if (req.method === 'POST') {
    const it = await readBody(req);
    if (!it?.id) return json(res, { error:'missing id' }, 400);
    await redis('hset', key, it.id, JSON.stringify(it));
    return json(res, { ok:true });
  }
  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if (!id) return json(res, { error:'missing id' }, 400);
    await redis('hdel', key, id);
    return json(res, { ok:true });
  }
  return json(res, { error:'Method Not Allowed' }, 405);
};
