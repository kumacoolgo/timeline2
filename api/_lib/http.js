// api/_lib/http.js
function getIP(req) {
  const xf = req.headers['x-forwarded-for'] || '';
  const first = xf.split(',').map(s => s.trim()).filter(Boolean)[0];
  return first || req.headers['x-real-ip'] || req.socket?.remoteAddress || '0.0.0.0';
}

function getOrigin(req) {
  const o = req.headers['origin'] || null;
  const ref = req.headers['referer'] || null;
  if (o) return o;
  if (ref) { try { return new URL(ref).origin; } catch { /* ignore */ } }
  return null;
}

function isWriteMethod(m) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes((m || 'GET').toUpperCase());
}

module.exports = { getIP, getOrigin, isWriteMethod };