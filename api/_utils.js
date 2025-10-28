const { pbkdf2Sync, randomBytes } = require('crypto');

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SESSION_TTL_DAYS } = process.env;
const TTL = Number(SESSION_TTL_DAYS || 7) * 86400;

async function redis(cmd, ...args){
  const url = `${UPSTASH_REDIS_REST_URL}/${String(cmd).toLowerCase()}`;
  const r = await fetch(url, {
    method:'POST',
    headers:{'authorization':`Bearer ${UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},
    body: JSON.stringify(args)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
  return data.result;
}

function json(res, obj, status=200){
  res.statusCode = status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(typeof obj==='string'?obj:JSON.stringify(obj));
}
async function readBody(req){
  if(req.body) return req.body;
  return await new Promise((resolve, reject)=>{
    let s=''; req.on('data',c=> s+=c); req.on('end', ()=>{ try{ resolve(JSON.parse(s||'{}')) }catch(e){ reject(e) } }); req.on('error',reject);
  });
}
function parseCookies(req){
  const c = req.headers.cookie || ''; const out={};
  c.split(';').forEach(p=>{const i=p.indexOf('='); if(i>0) out[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1))});
  return out;
}
function setCookie(res, name, value, days){
  const exp = new Date(Date.now()+days*864e5).toUTCString();
  res.setHeader('set-cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Expires=${exp}`);
}
function uid(){ return randomBytes(20).toString('hex') }
function normEmail(s){ return String(s||'').trim().toLowerCase() }

function genSalt(){ return randomBytes(16).toString('hex') }
function hashPassword(password, salt, iterations=210000){
  const dk = pbkdf2Sync(String(password), Buffer.from(salt,'hex'), iterations, 32, 'sha256').toString('hex');
  return `v1$${iterations}$${salt}$${dk}`;
}
function verifyPassword(password, hash){
  const [v, itStr, salt, hex] = String(hash||'').split('$');
  if(v!=='v1') return false;
  const calc = pbkdf2Sync(String(password), Buffer.from(salt,'hex'), Number(itStr), 32, 'sha256').toString('hex');
  return calc === hex;
}

async function getUserByEmail(email){
  const raw = await redis('get', `user:email:${normEmail(email)}`);
  if(!raw) return null;
  try{ return JSON.parse(raw) }catch{ return null }
}

async function createUser(email, password){
  email = normEmail(email);
  const exists = await redis('exists', `user:email:${email}`);
  if(exists) return { error:'exists' };
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = { uid: uid(), email, salt, hash, createdAt: Date.now() };
  await redis('set', `user:email:${email}`, JSON.stringify(user));
  await redis('set', `user:uid:${user.uid}`, email);
  return { user };
}

async function createSession(uid){
  const sid = uid + '.' + uid();
  await redis('set', `sid:${sid}`, uid);
  await redis('expire', `sid:${sid}`, TTL);
  return sid;
}
async function getUserIdBySession(req){
  const sid = parseCookies(req).sid;
  if(!sid) return null;
  const uid = await redis('get', `sid:${sid}`);
  return uid || null;
}
async function destroySession(req, res){
  const sid = parseCookies(req).sid;
  if(sid){
    await redis('del', `sid:${sid}`);
    setCookie(res,'sid','deleted',-1);
  }
}

module.exports = {
  json, readBody, redis, parseCookies, setCookie,
  uid, normEmail, genSalt, hashPassword, verifyPassword,
  getUserByEmail, createUser, createSession, getUserIdBySession, destroySession, TTL
};
