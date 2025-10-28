// api/debug.js  -- 只用于排查，验证完可以删
const { json, normEmail, redis } = require('./_utils');

module.exports = async (req, res) => {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL || '';
    const email = normEmail(new URL(req.url, 'http://x').searchParams.get('email') || '');
    let exists = null, sample = null;

    if (email) {
      const val = await redis('get', `user:email:${email}`);
      exists = !!val;
      if (val) {
        const obj = JSON.parse(val);
        sample = { uid: (obj.uid||'').slice(0,8), email: obj.email || null };
      }
    }

    return json(res, {
      env: {
        dbUrlHash: url ? url.replace(/^https?:\/\//,'').slice(0, 24) + '…' : null,
        hasUrl: !!url,
        hasToken: !!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN),
        vercelEnv: process.env.VERCEL_ENV || null
      },
      queryEmail: email || null,
      exists,
      sample
    });
  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
