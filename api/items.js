
// api/items.js - hardened with CSRF and validation
const { json, readBody, getUserIdBySession, redis, ensureCsrfCookie, requireCsrf } = require('./_utils');

// Basic validators and sanitizers
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = lo;
  return Math.min(Math.max(n, lo), hi);
}
function intval(n, def=0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : def;
}

function sanitizeItem(input) {
  const out = {};
  const type = String(input?.type || '').trim();
  if (!['plan','warranty','insurance'].includes(type)) throw new Error('非法类型');
  out.type = type;

  const name = String(input?.name || '').trim();
  if (!name) throw new Error('名称必填');
  if (name.length > 100) throw new Error('名称过长');
  out.name = name;

  const number = String(input?.number || '').trim();
  if (number.length > 100) throw new Error('编号过长');
  out.number = number;

  const startDate = String(input?.startDate || '').trim();
  if (!DATE_RE.test(startDate)) throw new Error('开始日格式错误');
  out.startDate = startDate;

  if (type === 'warranty') {
    out.warrantyMonths = clamp(input?.warrantyMonths ?? 0, 0, 1200);
    return out;
  }

  // plan / insurance
  out.billingDay = clamp(input?.billingDay ?? 1, 1, 28);

  // phases
  const phases = Array.isArray(input?.pricePhases) ? input.pricePhases : [];
  const normPhases = [];
  const seen = new Set();
  for (const p of phases) {
    const fm = clamp(p?.fromMonth ?? 1, 1, 1200);
    const amt = Math.max(0, Number(p?.amount ?? 0));
    if (seen.has(fm)) continue;
    seen.add(fm);
    normPhases.push({ fromMonth: fm, amount: amt });
  }
  normPhases.sort((a,b)=>a.fromMonth-b.fromMonth);
  out.pricePhases = normPhases;

  // cancel windows
  const cws = Array.isArray(input?.cancelWindows) ? input.cancelWindows : [];
  const normC = [];
  for (const w of cws) {
    const fm = clamp(w?.fromMonth ?? 1, 1, 1200);
    const tm = clamp(w?.toMonth ?? fm, 1, 1200);
    if (tm < fm) continue;
    normC.push({ fromMonth: fm, toMonth: tm });
  }
  normC.sort((a,b)=>a.fromMonth-b.fromMonth);
  out.cancelWindows = normC;

  if (type === 'insurance') {
    out.policyTermYears = clamp(input?.policyTermYears ?? 0, 0, 100);
    out.policyTermMonths = clamp(input?.policyTermMonths ?? 0, 0, 11);
  }

  return out;
}

module.exports = async (req, res) => {
  try {
    // Always ensure CSRF cookie exists
    ensureCsrfCookie(req, res);

    const uid = await getUserIdBySession(req);
    if(!uid) return json(res,{error:'Unauthorized'},401);
    const key = `items:${uid}`;

    if(req.method==='GET'){
      const obj = await redis('hgetall', key) || {};
      const arr = Object.values(obj).map(v => {
        if (!v) return null;
        try { return JSON.parse(v); } catch { return null; }
      }).filter(Boolean);
      arr.sort((a, b) => (a.order || 0) - (b.order || 0));
      return json(res, arr);
    }

    // Non-GET requires CSRF
    if (!requireCsrf(req)) return json(res, { error: 'CSRF 验证失败' }, 403);

    if(req.method==='POST'){
      const body = await readBody(req);
      const clean = sanitizeItem(body);
      const it = {
        id: body?.id || ('it_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
        order: body?.order || Date.now(),
        ...clean
      };
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
      const clean = sanitizeItem({ ...old, ...body, id });
      const fresh = { ...old, ...clean, id };
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
  } catch (e) {
    return json(res, { error: e.message || String(e) }, 500);
  }
};
