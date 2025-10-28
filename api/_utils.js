const crypto = require('crypto');
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
function json(res,obj,code=200){res.statusCode=code;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
async function readBody(req){const chunks=[];for await(const c of req) chunks.push(c);const raw=Buffer.concat(chunks).toString();try{return JSON.parse(raw||'{}')}catch{return {}}}
function parseCookies(req){const h=req.headers.cookie||'';const m={};h.split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)m[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1))});return m;}
function setCookie(res,name,value,opt={}){const a=[`${name}=${encodeURIComponent(value)}`];if(opt.maxAge)a.push(`Max-Age=${opt.maxAge}`);a.push('Path=/','SameSite=Lax','HttpOnly','Secure');res.setHeader('set-cookie',a.join('; '));}
async function redis(cmd,...args){const r=await fetch(`${UPSTASH_REDIS_REST_URL}/${String(cmd).toLowerCase()}`,{method:'POST',headers:{'authorization':`Bearer ${UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(args)});const d=await r.json();if(!r.ok)throw new Error(d?.error||`Upstash ${cmd} failed`);return d.result;}
async function redisPipeline(commands){const r=await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`,{method:'POST',headers:{'authorization':`Bearer ${UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(commands)});const d=await r.json();if(!r.ok)throw new Error(d?.error||'Upstash pipeline failed');return d.map(x=>x.result);}
function normEmail(e){return String(e||'').trim().toLowerCase()} function uid(){return crypto.randomBytes(16).toString('hex')} function genSalt(){return crypto.randomBytes(16).toString('hex')}
const ITER=210000,KEYLEN=32,DIGEST='sha256';
function hashPassword(pw,s){const hex=crypto.pbkdf2Sync(String(pw),String(s),ITER,KEYLEN,DIGEST).toString('hex');return `v1$${ITER}$${s}$${hex}`}
//function verifyPassword(pw,stored){const [v,iter,salt,hex]=String(stored).split('$');if(v!=='v1')return false;const h2=crypto.pbkdf2Sync(String(pw),String(salt),Number(iter),KEYLEN,DIGEST).toString('hex');return h2===hex}
// 兼容校验：优先用当前参数，其次尝试历史参数组合
function verifyPassword(pw, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 4) return false;
  const [v, iterStr, salt, hex] = parts;
  if (v !== 'v1') return false;
  const iter = Number(iterStr);
  const pwd = String(pw);
  // 1) 现在用的参数：sha256 + keylen 32
  try {
    const h1 = crypto.pbkdf2Sync(pwd, salt, iter, 32, 'sha256').toString('hex');
    if (h1 === hex) return true;
  } catch(_) {}

  // 2) 兼容：sha512 + keylen 64（很多早期示例/项目用过）
  try {
    const h2 = crypto.pbkdf2Sync(pwd, salt, iter, 64, 'sha512').toString('hex');
    if (h2 === hex) return true;
  } catch(_) {}

  // 3) 兼容：sha512 + keylen 32（有的项目用 32 字节但换了 digest）
  try {
    const h3 = crypto.pbkdf2Sync(pwd, salt, iter, 32, 'sha512').toString('hex');
    if (h3 === hex) return true;
  } catch(_) {}

  return false;
}


async function getUserByEmail(email){const key=`user:email:${normEmail(email)}`;const raw=await redis('get',key);return raw?JSON.parse(raw):null}
async function createUser(email,password){email=normEmail(email);const key=`user:email:${email}`;const exists=await redis('exists',key);if(exists)return{error:'exists'};const salt=genSalt();const hash=hashPassword(password,salt);const user={uid:uid(),email,salt,hash,createdAt:Date.now()};await redisPipeline([['set',key,JSON.stringify(user)],['set',`user:uid:${user.uid}`,email]]);return{user}}
async function createSession(res,uid){const sid=uid+':'+crypto.randomBytes(10).toString('hex');await redis('setex',`sess:${sid}`,TTL_DAYS*86400,uid);setCookie(res,'sid',sid,{maxAge:TTL_DAYS*86400});return sid}
async function getUserIdBySession(req){const sid=(parseCookies(req).sid);if(!sid)return null;return await redis('get',`sess:${sid}`)}

// [修复] 添加 destroySession 函数
async function destroySession(req, res) {
  const sid = (parseCookies(req).sid);
  if (sid) {
    await redis('del', `sess:${sid}`);
  }
  // 强制清除客户端 cookie
  setCookie(res, 'sid', '', { maxAge: 0 });
}

module.exports={
  json,readBody,parseCookies,setCookie,redis,redisPipeline,
  normEmail,uid,genSalt,hashPassword,verifyPassword,
  getUserByEmail,createUser,createSession,getUserIdBySession,
  TTL:TTL_DAYS,
  destroySession // [修复] 导出 destroySession
};