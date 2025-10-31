// api/_lib/withSecurity.js
const { ensureCsrfCookie, verifyCsrf, verifyOrigin } = require('./csrf');
const { isWriteMethod } = require('./http');

async function readBodyForSecurity(req) {
  if (req.body) return;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    req.body = JSON.parse(raw || '{}');
  } catch (e) { req.body = {}; }
}

function withSecurity(handler, options = {}) {
  return async function secured(req, res) {
    try {
      ensureCsrfCookie(req, res);

      if (isWriteMethod(req.method)) {
        const allow = (options.allowedOrigins || (process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : [])).filter(Boolean);
        const oc = verifyOrigin(req, allow);
        if (!oc.ok) {
          res.statusCode = 403;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ error: 'Forbidden', reason: oc.reason || 'origin' }));
        }
        if (options.csrf !== false) {
          const cv = verifyCsrf(req);
          if (!cv.ok) {
            res.statusCode = 403;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ error: 'Forbidden', reason: cv.reason || 'csrf' }));
          }
        }
        res.setHeader('Vary', 'Cookie,Origin');
      }

      if (options.rateLimit) {
        if (isWriteMethod(req.method)) await readBodyForSecurity(req);
        const ok = await options.rateLimit(req, res);
        if (!ok) return;
      }

      return await handler(req, res);
    } catch (e) {
      console.error('API handler error:', e.message, e.stack);
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Internal ServerError' }));
    }
  };
}

module.exports = { withSecurity };
