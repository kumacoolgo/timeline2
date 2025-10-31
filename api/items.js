// api/items.js - Hash 存储 (最终健壮版)
const { json, readBody, getUserIdBySession, redis } = require('./_utils');

module.exports = async (req, res) => {
  try { // ⬅️ 【修改 1】添加全局 try...catch
    const uid = await getUserIdBySession(req);
    if(!uid) return json(res,{error:'Unauthorized'},401);
    const key = `items:${uid}`;

    if(req.method==='GET'){
      const obj = await redis('hgetall', key) || {};
      
      // ⬅️ 【修改 2】使用更健壮的解析方法
      const arr = Object.values(obj).map(v => {
        if (!v) return null; // 过滤掉空值
        try {
          return JSON.parse(v); // 尝试解析
        } catch (e) {
          // 在 Vercel 后台日志中打印错误，但不要让应用崩溃
          console.error('Corrupted item in Redis, skipping:', v, e.message);
          return null; // 解析失败，返回 null
        }
      }).filter(Boolean); // 过滤掉所有 null (解析失败或空值)

      arr.sort((a, b) => (a.order || 0) - (b.order || 0));
      return json(res, arr);
    }

    if(req.method==='POST'){
      const it = await readBody(req);
      it.id = it.id || ('it_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
      it.order = it.order || Date.now(); 
      await redis('hset', key, it.id, JSON.stringify(it));
      return json(res, it);
    }

    if(req.method==='PUT'){
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if(!id) return json(res,{error:'缺少 id'},400);
      const oldRaw = await redis('hget', key, id);
      if(!oldRaw) return json(res,{error:'Not Found'},404);
      const old = JSON.parse(oldRaw);
      const body = await readBody(req);
      const fresh = { ...old, ...body, id }; 
      await redis('hset', key, id, JSON.stringify(fresh));
      return json(res,{ok:true});
    }
    
    if(req.method==='DELETE'){
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if(!id) return json(res,{error:'缺少 id'},400);
      const n = await redis('hdel', key, id);
      if(!n) return json(res,{error:'Not Found'},404);
      return json(res,{ok:true});
    }

    return json(res,{error:'Method Not Allowed'},405);
  
  } catch (e) { // ⬅️ 【修改 1】添加全局 try...catch
    // 防止函数崩溃，返回一个标准的 JSON 错误
    return json(res, { error: e.message || String(e) }, 500);
  }
};