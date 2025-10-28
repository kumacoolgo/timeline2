const { json, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error: 'Unauthorized' }, 401);
  const email = await redis('GET', `user:uid:${uid}`);
  return json(res, { uid, email: email || null });
};
