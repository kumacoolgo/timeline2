const { json, getUserIdBySession } = require('./_utils');

module.exports = async (req, res) => {
  const uid = await getUserIdBySession(req);
  if (!uid) return json(res, { error: 'Unauthorized' }, 401);
  return json(res, { uid });
};
