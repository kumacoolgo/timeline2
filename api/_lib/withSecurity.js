// api/_lib/withSecurity.js
const { ensureCsrfCookie, verifyCsrf, verifyOrigin } = require('./csrf');
const { isWriteMethod } = require('./http');

// 辅助函数，确保 body 被解析 (Vercel Serverless 默认不解析)
async function readBodyForSecurity(req) {
  if (req.body) return; // 已被解析
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    req.body = JSON.parse(raw || '{}');
  } catch (e) {
    req.body = {};
  }
}

function withSecurity(handler, options = {}) {
  return async function secured(req, res) {
    try {
      // 始终确保 CSRF Cookie 存在
      ensureCsrfCookie(req, res);
      
      // 仅对写操作检查
      if (isWriteMethod(req.method)) {
        const allow = options.allowedOrigins || (process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : undefined);
        const oc = verifyOrigin(req, allow);
        if (!oc.ok) {
          res.statusCode = 403;
          return res.end(JSON.stringify({ error: 'Forbidden', reason: oc.reason || 'origin' }));
        }

        if (options.csrf !== false) {
          const cv = verifyCsrf(req);
          if (!cv.ok) {
            res.statusCode = 403;
            return res.end(JSON.stringify({ error: 'Forbidden', reason: cv.reason || 'csrf' }));
          }
        }
        res.setHeader('Vary', 'Cookie,Origin');
      }
      
      // 在限流前确保 body 可读
      if (options.rateLimit) {
         if (isWriteMethod(req.method)) {
           await readBodyForSecurity(req);
         }
         const ok = await options.rateLimit(req, res);
         if (!ok) return; // 响应已在 apply() 中发送
      }

      return await handler(req, res);

    } catch (e) {
      console.error('API handler error:', e.message, e.stack);
      res.statusCode = 500;
      // 避免泄露 e.message
      return res.end(JSON.stringify({ error: 'Internal ServerError' }));
    }
  };
}

module.exports = { withSecurity };