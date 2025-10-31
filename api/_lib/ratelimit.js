// api/_lib/ratelimit.js
// 安全降级版：如果没配 Upstash 环境变量，限流自动 fail-open，不阻断部署/运行。

let haveUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

let Ratelimit, Redis;
try {
  // 只有在环境变量齐全时才加载依赖，避免构造器因 url/token 为空在模块加载期抛错
  if (haveUpstash) {
    Ratelimit = require('@upstash/ratelimit').Ratelimit;
    Redis = require('@upstash/redis').Redis;
  }
} catch (e) {
  // 依赖没装或其它异常，也降级
  console.warn('[RateLimit] deps load failed, falling back (', e?.message, ')');
  haveUpstash = false;
}

let redisClient = null;
let rl = null;

if (haveUpstash) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    rl = {
      globalIp10m: new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(120, '10 m'), prefix: 'rl:g:ip10m' }),
      loginIp10m:  new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(20,  '10 m'), prefix: 'rl:login:ip' }),
      codeEmail10m:new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(5,   '10 m'), prefix: 'rl:code:email' }),
      codeIp10m:   new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(20,  '10 m'), prefix: 'rl:code:ip' }),
      writeUser10m:new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(60,  '10 m'), prefix: 'rl:items:user' }),
    };
  } catch (e) {
    console.warn('[RateLimit] init failed, falling back (', e?.message, ')');
    haveUpstash = false;
    rl = null;
  }
}

// 统一的 apply：若 rl 不可用，则直接放行（fail-open），仅记录一次警告
let warned = false;
async function apply(limiter, key, res) {
  if (!haveUpstash || !limiter) {
    if (!warned) {
      console.warn('[RateLimit] Upstash 未配置或初始化失败，限流已自动关闭（应用继续运行）。');
      warned = true;
    }
    return true; // 放行
  }

  try {
    const r = await limiter.limit(key);
    res.setHeader('X-RateLimit-Limit', String(r.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, r.remaining)));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(r.reset / 1000)));
    if (!r.success) {
      const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.statusCode = 429;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[RateLimit] error:', e?.message || e);
    return true; // fail-open
  }
}

// 对外导出与原 API 一致
async function limitAuthLogin(req, res) {
  return apply(rl?.loginIp10m, req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0', res);
}
async function limitAuthSendCode(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email) {
    const ok = await apply(rl?.codeEmail10m, `em:${email}`, res);
    if (!ok) return false;
  }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0';
  return apply(rl?.codeIp10m, `ip:${ip}`, res);
}
async function limitItemsWrite(req, res, userId) {
  const key = userId ? `u:${userId}` : `ip:${(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0')}`;
  return apply(rl?.writeUser10m, key, res);
}
async function limitGlobal(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0';
  return apply(rl?.globalIp10m, `ip:${ip}`, res);
}

module.exports = { limitAuthLogin, limitAuthSendCode, limitItemsWrite, limitGlobal };
