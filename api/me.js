const { withSecurity } = require('./_lib/withSecurity');
const { json, getUserIdBySession, redis } = require('./_utils');

async function handler(req, res) {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error:'Unauthorized' }, 401);
  const email = await redis('get', `user:uid:${uid}`);
  return json(res, { uid, email: email || null });
}

module.exports = withSecurity(handler, {
  csrf: false,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean)
});
