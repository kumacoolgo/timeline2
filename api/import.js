// api/import.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitItemsWrite } = require('./_lib/ratelimit');
// 引入 validateItem
const { json, readBody, getUserIdBySession, redis, uid, validateItem } = require('./_utils');

module.exports = withSecurity(async (req, res) => {
  if (req.method !== 'POST') return json(res, { error:'Method Not Allowed' }, 405);
  const userId = await getUserIdBySession(req);
  if (!userId) return json(res, { error:'Unauthorized' }, 401);

  const body = await readBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(res, { error:'No items' }, 400);

  const key = `items:${userId}`;
  // 为了安全，限制一次导入数量，避免超大包 DoS
  const MAX_IMPORT = 500;
  const targetItems = items.slice(0, MAX_IMPORT);

  for (const it of targetItems) {
    // --- 安全修改：严格校验每项数据，格式不对直接跳过，不报错中断 ---
    if (validateItem(it)) continue; 
    
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