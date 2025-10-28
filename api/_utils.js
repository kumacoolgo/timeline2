// api/_utils.js
const crypto = require('crypto');

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SESSION_TTL_DAYS } = process.env;
const TTL = Number(SESSION_TTL_DAYS || 30) * 24 * 3600; // seconds

function json(res, data, code=200){
  res.statusCode = code;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function parseCookies(req){
  const h = req.headers.cookie || '';
  const map = {};
  h.split(';').forEach(p=>{
    const i=p.indexOf('='); if(i>0){ const k=p.slice(0,i).trim(); map[k]=decodeURIComponent(p.slice(i+1)); }
  });
  return map;
}
function setCookie(res, name, value, attrs={}){
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if(attrs.maxAge!=null) parts.push(`Max-Age=${attrs.maxAge}`);
  if(attrs.path) parts.push(`Path=${attrs.path}`); else parts.push(`Path=/`);
  if(attrs.httpOnly!==false) parts.push(`HttpOnly`);
  parts.push(`SameSite=Lax`);
  parts.push(`Secure`);
  res.setHeader('set-cookie', parts.join('; '));
}
async function readBody(req){
  return await new Promise((resolve,reject)=>{
    let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ try{ resolve(JSON.parse(b||'{}')) }catch(e){ resolve({}) } }); req.on('error',reject);
  });
}

async function redis(cmd, ...args){
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/${cmd.toLowerCase()}`, {
    method:'POST',
    headers:{ 'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'content-type':'application/json' },
    body: JSON.stringify(args)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
  return data.result;
}
async function redisPipeline(commands){
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method:'POST',
    headers:{ 'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'content-type':'application/json' },
    body: JSON.stringify(commands)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error || `Upstash pipeline failed`);
  return data.map(d=>d.result);
}

const normEmail = s => String(s||'').trim().toLowerCase();
const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
const genSalt = () => crypto.randomBytes(16).toString('hex');
const hashPassword = (password,salt) => crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');

async function createUser(email, password){
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('exists', key);
  if(exists) return { error: '邮箱已存在' };
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redisPipeline([ ['set', key, JSON.stringify(user)], ['set', `user:uid:${user.uid}`, user.email] ]);
  return { user };
}
async function getUserByEmail(email){
  const raw = await redis('get', `user:email:${normEmail(email)}`);
  return raw ? JSON.parse(raw) : null;
}

async function createSession(res, uid){
  const sid = crypto.randomBytes(16).toString('hex');
  await redis('set', `sess:${sid}`, uid);
  await redis('expire', `sess:${sid}`, TTL);
  setCookie(res, 'sid', sid, {maxAge: TTL, httpOnly:true, path:'/'});
  return sid;
}
async function destroySession(req, res){
  const sid = parseCookies(req).sid; if(!sid){ setCookie(res,'sid','',{maxAge:0}); return; }
  await redis('del', `sess:${sid}`);
  setCookie(res,'sid','',{maxAge:0});
}
async function getUserIdBySession(req){
  const sid = parseCookies(req).sid;
  if(!sid) return null;
  const uid = await redis('get', `sess:${sid}`);
  return uid || null;
}

module.exports = {
  json, parseCookies, setCookie, readBody,
  redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword,
  createUser, getUserByEmail,
  createSession, destroySession, getUserIdBySession, TTL
};
