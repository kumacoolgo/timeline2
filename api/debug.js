// api/debug.js
const { json } = require('./_utils');

const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;

async function upstash(cmd, ...args) {
  // 统一用 POST，失败时给出详细报错
  const r = await fetch(`${URL}/${String(cmd).toLowerCase()}`, {
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
    const u = new URL(req.url, 'http://x');
    const email = (u.searchParams.get('email') || '').trim().toLowerCase();
    const key = email ? `user:email:${email}` : null;

    // 1) 返回当前函数用到的 env 是否就绪（只显示 hash 以免泄漏）
    const env = {
      hasUrl: !!URL,
      hasToken: !!TOKEN,
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV,
      dbUrlHash: URL ? URL.replace(/^https?:\/\//, '').slice(0, 24) + '…' : null,
    };

    // 2) PING 验证连通性
    let ping = null;
    try { ping = await upstash('PING'); } catch (e) { ping = `ERR:${e.message}`; }

    // 3) 如果传 email，检查是否存在；并尝试“写入→读取”一对临时 key 验证同库
    let exists = null, sample = null, echoWriteRead = null;
    if (key) {
      try {
        const raw = await upstash('GET', key);
        exists = !!raw;
        sample = raw ? JSON.parse(raw) : null;
      } catch (e) {
        exists = false;
        sample = null;
      }

      // 写入→读取一次临时 key：__debug_<timestamp>
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
