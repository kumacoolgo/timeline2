// api/csrf.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitGlobal } = require('./_lib/ratelimit');
const { ensureCsrfCookie } = require('./_lib/csrf');

async function handler(req, res) {
  // ensureCsrfCookie 已在 withSecurity 中调用
  res.statusCode = 204;
  res.end();
}

// 包装 handler
// csrf: false 因为这是获取 token 的端点
// rateLimit: 使用全局限流器
module.exports = withSecurity(handler, { 
  csrf: false, 
  rateLimit: limitGlobal 
});