// api/export.js
const { withSecurity } = require('./_lib/withSecurity');
const { json, getUserIdBySession, redis } = require('./_utils');

module.exports = withSecurity(async (req, res) => {
  if (req.method !== 'GET') return json(res, { error:'Method Not Allowed' }, 405);
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error:'Unauthorized' }, 401);
  const key = `items:${uid}`;
  const obj = await redis('hgetall', key) || {};
  const arr = Object.values(obj).map(v=>{ if(!v) return null; try{ return JSON.parse(v); }catch{ return null; } }).filter(Boolean);
  arr.sort((a,b)=>(a.order||0)-(b.order||0));
  return json(res, arr);
}, {
  csrf: false,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean)
});
