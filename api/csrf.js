// api/csrf.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitGlobal } = require('./_lib/ratelimit');

async function handler(req, res) {
  res.statusCode = 204;
  res.end();
}

module.exports = withSecurity(handler, {
  csrf: false,
  rateLimit: limitGlobal,
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean)
});
