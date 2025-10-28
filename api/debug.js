// api/debug.js  —— 部署后可临时访问 /api/debug?email=xxx
const {
  json, normEmail, redisGetCompat
} = require('./_utils');

module.exports = async (req, res) => {
  const email = normEmail(new URL(req.url, 'http://x').searchParams.get('email') || '');
  const key = `user:email:${email}`;
  let sample = null, exists = false, err = null;

  try {
    const raw = await redisGetCompat(key);
    exists = !!raw;
    if (raw) sample = JSON.parse(raw);
  } catch (e) {
    err = e.message || String(e);
  }

  json(res, {
    env: {
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      // 仅做 hash，避免暴露 URL
      dbUrlHash: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^https?:\/\//, '').slice(0, 25) + '…'
    },
    queryEmail: email, key, exists, sample, err
  });
};
