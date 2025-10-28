const { json } = require('./_utils');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;

// 走 pipeline 的小工具
async function pipe(cmds){
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds.map(c => [String(c[0]).toUpperCase(), ...c.slice(1)])),
  });
  const d = await r.json();
  if(!r.ok) throw new Error(d?.error || 'pipeline failed');
  return d.map(x => x.result);
}

module.exports = async (req,res)=>{
  try{
    const u = new URL(req.url, 'http://x');
    const email = (u.searchParams.get('email')||'').trim().toLowerCase();
    const key = email ? `user:email:${email}` : null;

    const env = {
      hasUrl: !!REDIS_URL, hasToken: !!TOKEN,
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV,
      dbUrlHash: REDIS_URL ? REDIS_URL.replace(/^https?:\/\//,'').slice(0,24)+'…' : null
    };

    let ping = null; try{ ping = (await pipe([['PING']]))[0]; } catch(e){ ping = 'ERR:'+e.message }

    let exists=null, sample=null, echoWriteRead=null;
    if(key){
      try{
        const v = (await pipe([['GET', key]]))[0];
        exists = !!v; sample = v ? JSON.parse(v) : null;
      }catch{ exists=false; sample=null }
      try{
        const tkey=`__debug_${Date.now()}`, tval=`ts:${Date.now()}`;
        const [ok1, got, ok3] = await pipe([['SET', tkey, tval], ['GET', tkey], ['DEL', tkey]]);
        echoWriteRead = { wrote:tval, read:got, same: got===tval, setOk: ok1, delOk: ok3 };
      }catch(e){ echoWriteRead = { err: String(e) } }
    }

    return json(res, { env, ping, queryEmail: email||null, key, exists, sample, echoWriteRead });
  }catch(e){
    return json(res, { error: e.message || 'debug_error' }, 500);
  }
};
