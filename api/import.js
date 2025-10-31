// api/import.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitItemsWrite } = require('./_lib/ratelimit');
const { json, readBody, getUserIdBySession, redis, uid } = require('./_utils');

module.exports = withSecurity(async (req, res) => {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);
  const userId = await getUserIdBySession(req);
  if (!userId) return json(res, { error:'Unauthorized' }, 401);

  const body = await readBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(res, { error:'No items' }, 400);

  const key = `items:${userId}`;
  for (const it of items) {
    // 最小校验：必填字段与类型
    if (!it || !it.type || !it.name || !it.startDate) continue;
    const id = 'it_' + uid().slice(0, 8);
    const order = Date.now();
    it.id = id; it.order = order;
    await redis('hset', key, id, JSON.stringify(it));
  }
  return json(res, { ok:true });
}, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitItemsWrite
});
