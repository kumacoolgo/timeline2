// api/debug.js
const { json, redis, normEmail } = require('./_utils');

module.exports = async (req, res) => {
  try {
    const q = new URL(req.url, 'http://x'); // 一定要 new URL
    const email = normEmail(q.searchParams.get('email') || '');
    const key = email ? `user:email:${email}` : null;

    // 环境检查
    const env = {
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      dbUrlHash: (process.env.UPSTASH_REDIS_REST_URL || '').split('://')[1]?.slice(0, 24) + '…'
    };

    // 轻量 ping
    let ping = [];
    try {
      ping = await redis('ping'); // Upstash 支持 ping
    } catch (e) {}

    // 读用户
    let exists = false, sample = null, err = null;
    if (key) {
      try {
        const raw = await redis('get', key);
        if (raw) {
          exists = true;
          sample = JSON.parse(raw);
        }
      } catch (e) { err = e.message || String(e); }
    }

    // 验证一次 set/get（严格用字符串，避免“参数个数错误”）
    let echo = null;
    try {
      const ek = 'echo:' + Date.now();
      await redis('set', ek, 'ok');       // set 只允许 key + value（都是字符串）
      const got = await redis('get', ek); // should be 'ok'
      echo = { wrote: 'ok', read: got };
    } catch (e) {
      echo = { err: e.message || String(e) };
    }

    return json(res, { env, ping: Array.isArray(ping)?ping:[], queryEmail: email, key, exists, sample, echo });
  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
