// api/_lib/cookies.js
function parseCookies(req) {
  const str = req.headers.cookie || '';
  const out = {};
  str.split(';').forEach(pair => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (!k) return;
    try { out[k] = decodeURIComponent(v); }
    catch { out[k] = v; }
  });
  return out;
}

function makeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) {
    const v = String(opts.sameSite);
    if (['Strict', 'Lax', 'None'].includes(v)) parts.push(`SameSite=${v}`);
  }
  return parts.join('; ');
}

function appendSetCookie(res, cookieStr) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookieStr);
  else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, cookieStr]);
  else res.setHeader('Set-Cookie', [prev, cookieStr]);
}

module.exports = { parseCookies, makeCookie, appendSetCookie };
