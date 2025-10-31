// api/_lib/ratelimit.js
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const { getIP } = require('./http');

const redis = Redis.fromEnv();

const rl = {
  globalIp10m: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '10 m'), prefix: 'rl:g:ip10m' }),
  loginIp10m: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '10 m'), prefix: 'rl:login:ip' }),
  codeEmail10m: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'rl:code:email' }),
  codeIp10m: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '10 m'), prefix: 'rl:code:ip' }),
  writeUser10m: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '10 m'), prefix: 'rl:items:user' }),
};

async function apply(limiter, key, res) {
  try {
    const r = await limiter.limit(key);
    res.setHeader('X-RateLimit-Limit', String(r.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, r.remaining)));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(r.reset / 1000)));
    
    if (!r.success) {
      const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.statusCode = 429;
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Rate limit error:', e);
    // Fail-open on ratelimit error
    return true; 
  }
}

async function limitAuthLogin(req, res) {
  return apply(rl.loginIp10m, getIP(req), res);
}

async function limitAuthSendCode(req, res) {
  // 确保 body 已被解析
  const email = (req.body?.email || '').toLowerCase().trim();
  if (email) {
    if (!await apply(rl.codeEmail10m, `em:${email}`, res)) return false;
  }
  return apply(rl.codeIp10m, `ip:${getIP(req)}`, res);
}

async function limitItemsWrite(req, res, userId) {
  return apply(rl.writeUser10m, userId ? `u:${userId}` : `ip:${getIP(req)}`, res);
}

async function limitGlobal(req, res) {
  return apply(rl.globalIp10m, `ip:${getIP(req)}`, res);
}

module.exports = { limitAuthLogin, limitAuthSendCode, limitItemsWrite, limitGlobal };