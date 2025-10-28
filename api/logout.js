const { json, destroySession } = require('./_utils');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'Method Not Allowed' }, 405);
  await destroySession(req, res);
  return json(res, { ok: true });
};
