const { json, readBody, getUserIdBySession, redis } = require('./_utils');


// 使用 Redis Hash 存储：items:<uid> 是一个 Hash
// field = item.id, value = JSON.stringify(item)
// 好处：单项原子更新、无需读写整数组、并发友好


module.exports = async (req, res) => {
const uid = await getUserIdBySession(req);
if (!uid) return json(res, { error: 'Unauthorized' }, 401);
const key = `items:${uid}`;


if (req.method === 'GET') {
let arr = [];
try {
const raw = await redis('HGETALL', key);
if (Array.isArray(raw)) {
for (let i = 0; i < raw.length; i += 2) {
try { arr.push(JSON.parse(raw[i+1])); } catch {}
}
} else if (raw && typeof raw === 'object') {
arr = Object.values(raw).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
}
} catch (e) {
// 兼容旧版（String 大数组）→ 一次性迁移到 Hash
try {
const legacy = await redis('GET', key); // 旧版是 String
if (legacy) {
const legacyArr = JSON.parse(legacy);
await redis('DEL', key); // 删除旧 String 键，避免 WRONGTYPE
for (const it of legacyArr) {
if (!it.id) it.id = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
if (!it.createdAt) it.createdAt = Date.now();
await redis('HSET', key, it.id, JSON.stringify(it));
}
arr = legacyArr;
} else {
throw e;
}
} catch (_) {
throw e;
}
}
arr.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
return json(res, arr);
}


if (req.method === 'POST') {
const it = await readBody(req);
it.id = it.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
};