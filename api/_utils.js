const crypto = require('crypto');

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS||'30');

function json(res, data, status=200){
  res.statusCode=status; res.setHeader('content-type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function parseCookies(req){ const h=req.headers?.cookie||''; const m={}; h.split(';').forEach(p=>{ const i=p.indexOf('='); if(i>0){ m[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1)) } }); return m }
function setCookie(res, name, val, opts={}){
  const parts=[`${name}=${encodeURIComponent(val)}`];
  if(opts.maxAge!==undefined) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push('Path=/','SameSite=Lax','HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}
async function readBody(req){ const chunks=[]; for await (const c of req) chunks.push(c); const raw=Buffer.concat(chunks).toString('utf8'); try{return JSON.parse(raw||'{}')}catch{return {}} }

async function redis(cmd, ...args){
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/${cmd.toLowerCase()}`, {
    method:'POST',
    headers:{'authorization':`Bearer ${UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},
    body: JSON.stringify(args)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error||`upstash ${cmd} failed`);
  return data.result;
}
async function redisPipeline(commands){
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method:'POST',
    headers:{'authorization':`Bearer ${UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},
    body: JSON.stringify(commands)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error||`upstash pipeline failed`);
  return data.map(x=>x.result);
}

function normEmail(e){return String(e||'').trim().toLowerCase()}
function uid(){ return crypto.randomBytes(16).toString('hex') }
function genSalt(){ return crypto.randomBytes(16).toString('hex') }
function hashPassword(password, salt){ const iters=210000; const dk = crypto.pbkdf2Sync(String(password), Buffer.from(salt,'hex'), iters, 32, 'sha256'); return `v1$${iters}$${salt}$${dk.toString('hex')}` }
function verifyPassword(password, hash){
  try{
    const [v, iters, salt, hex] = String(hash).split('$').slice(1);
    const dk = crypto.pbkdf2Sync(String(password), Buffer.from(salt,'hex'), Number(iters), 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hex,'hex'), Buffer.from(dk,'hex'));
  }catch{ return false }
}

async function getUserByEmail(email){
  email = normEmail(email);
  const raw = await redis('get', `user:email:${email}`);
  return raw? JSON.parse(raw) : null;
}
async function createUser(email, password){
  email = normEmail(email);
  const key = `user:email:${email}`;
  const exists = await redis('exists', key);
  if(exists) return {error:'邮箱已存在'};
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redisPipeline([
    ['set', key, JSON.stringify(user)],
    ['set', `user:uid:${user.uid}`, user.email]
  ]);
  return { user };
}

async function createSession(res, uid){
  const sid = uid + '.' + crypto.randomBytes(12).toString('hex');
  const ttl = TTL_DAYS*24*3600;
  await redis('set', `sess:${sid}`, uid, 'EX', ttl);
  setCookie(res, 'sid', sid, {maxAge: ttl});
  return sid;
}
async function getUserIdBySession(req){
  const sid = parseCookies(req).sid; if(!sid) return null;
  return await redis('get', `sess:${sid}`);
}
async function destroySession(req, res){
  const sid = parseCookies(req).sid;
  if(sid) await redis('del', `sess:${sid}`);
  setCookie(res, 'sid', '', {maxAge:0});
}

module.exports = {
  json, readBody, parseCookies, setCookie,
  redis, redisPipeline,
  normEmail, uid, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser,
  createSession, getUserIdBySession, destroySession,
  TTL: TTL_DAYS
};
