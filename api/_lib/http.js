// api/_lib/http.js
function isWriteMethod(m = 'GET') {
  const mm = String(m || '').toUpperCase();
  return mm === 'POST' || mm === 'PUT' || mm === 'PATCH' || mm === 'DELETE';
}

function getOrigin(req) {
  const o = req.headers.origin || '';
  if (o) return o;
  // 有些情况下只有 referer
  const ref = req.headers.referer || '';
  try {
    if (ref) return new URL(ref).origin;
  } catch {}
  return '';
}

function getIP(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    const first = xf.split(',')[0].trim();
    return first || req.socket?.remoteAddress || '0.0.0.0';
  }
  return req.socket?.remoteAddress || '0.0.0.0';
}

module.exports = { isWriteMethod, getOrigin, getIP };
