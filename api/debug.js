// api/debug.js
const { json } = require('./_utils');

// <<< 关键修正：不要用 URL 这个名字，会遮蔽全局 URL 构造器
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;

async function upstash(cmd, ...args) {
  const r = await fetch(`${REDIS_URL}/${String(cmd).toLowerCase()}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `upstash ${cmd} failed`);
  return d.result;
}

module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'); // 现在不会被遮蔽
    const email = (u.searchParams.get('email') || '').trim().toLowerCase();
    const key = email ? `user:email:${email}` : null;

    const env = {
      hasUrl: !!REDIS_URL,
      hasToken: !!TOKEN,
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV,
      dbUrlHash: REDIS_URL ? REDIS_URL.replace(/^https?:\/\//, '').slice(0, 24) + '…' : null,
    };

    let ping = null;
    try { ping = await upstash('PING'); } catch (e) { ping = `ERR:${e.message}`; }

    let exists = null, sample = null, echoWriteRead = null;
    if (key) {
      try {
        const raw = await upstash('GET', key);
        exists = !!raw;
        sample = raw ? JSON.parse(raw) : null;
      } catch {
        exists = false;
        sample = null;
      }
      const tkey = `__debug_${Date.now()}`;
      const tval = `ts:${Date.now()}`;
      try {
        await upstash('SET', tkey, tval);
        const got = await upstash('GET', tkey);
        echoWriteRead = { wrote: tval, read: got, same: got === tval };
        await upstash('DEL', tkey);
      } catch (e) {
        echoWriteRead = { err: String(e) };
      }
    }

    return json(res, { env, ping, queryEmail: email || null, key, exists, sample, echoWriteRead });
  } catch (e) {
    return json(res, { error: e.message || 'debug_error' }, 500);
  }
};
