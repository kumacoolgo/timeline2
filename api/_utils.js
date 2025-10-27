// Serverless (Node.js 18+) 工具：Upstash、会话 Cookie、PBKDF2 密码哈希
const crypto = require('crypto');


const TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '30', 10);
const TTL = TTL_DAYS * 24 * 60 * 60; // seconds


const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;


function json(res, obj, status = 200) {
res.statusCode = status;
res.setHeader('content-type', 'application/json');
res.end(JSON.stringify(obj));
}


function parseCookies(req) {
const h = req.headers['cookie'] || '';
const out = {};
h.split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
return out;
}


function setCookie(res, name, value, { maxAge = TTL } = {}) {
const attrs = [
`${name}=${encodeURIComponent(value)}`,
'Path=/', 'HttpOnly', 'SameSite=Lax'
];
if (process.env.VERCEL_URL) attrs.push('Secure');
if (maxAge) attrs.push(`Max-Age=${maxAge}`);
res.setHeader('Set-Cookie', attrs.join('; '));
}


async function readBody(req) {
return await new Promise(resolve => {
let raw = '';
req.on('data', c => raw += c);
req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});
}


// --- Upstash Redis via REST pipeline ---
async function redis(cmd, ...args) {
const r = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
method: 'POST',
headers: {
'authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
'content-type': 'application/json'
},
body: JSON.stringify([[cmd, ...args]])
});
const data = await r.json();
if (!r.ok) throw new Error(data?.error || `Upstash ${cmd} failed`);
};