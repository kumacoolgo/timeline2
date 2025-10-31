// api/debug.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitGlobal } = require('./_lib/ratelimit');
const { json } = require('./_utils');

module.exports = withSecurity(async (req, res) => {
  if (process.env.ENABLE_DEBUG_API !== '1') {
    res.statusCode = 404;
    return res.end('Not Found');
  }
  return json(res, { ok: true, ts: Date.now() });
}, {
  csrf: true,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitGlobal
});
