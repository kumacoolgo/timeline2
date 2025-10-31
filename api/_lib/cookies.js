// api/_lib/cookies.js
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  header.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      if (k) map[k] = decodeURIComponent(v);
    }
  });
  return map;
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  let arr = [];
  if (Array.isArray(prev)) arr = prev;
  else if (typeof prev === 'string') arr = [prev];
  res.setHeader('Set-Cookie', [...arr, cookie]);
}

function makeCookie(name, value, opts) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${opts.path || '/'}`;
  if (opts.maxAge) c += `; Max-Age=${Math.floor(opts.maxAge)}`;
  if (opts.httpOnly) c += '; HttpOnly';
  if (opts.secure !== false) c += '; Secure';
  if (opts.sameSite) c += `; SameSite=${opts.sameSite}`;
  if (opts.domain) c += `; Domain=${opts.domain}`;
  return c;
}

module.exports = { parseCookies, appendSetCookie, makeCookie };