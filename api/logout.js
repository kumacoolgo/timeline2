// api/logout.js
const { withSecurity } = require('./_lib/withSecurity');
const { json, destroySession } = require('./_utils');

async function handler(req, res) {
  if(req.method !== 'POST') {
    return json(res, { error: 'Method Not Allowed' }, 405);
  }
  await destroySession(req, res);
  return json(res, { ok: true });
}

module.exports = withSecurity(handler, {
  csrf: true, // 登出必须防 CSRF
  allowedOrigins: [process.env.PUBLIC_ORIGIN]
  // 无需特殊限流
});