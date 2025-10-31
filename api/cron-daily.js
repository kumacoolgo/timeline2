// api/cron-daily.js
const { withSecurity } = require('./_lib/withSecurity');
const { limitGlobal } = require('./_lib/ratelimit');
const { json, redis, redisPipeline, sendEmail } = require('./_utils');

function parseISODate(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, d.getDate()); }
function fmtDate(d){ const y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate(); return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }

function resolvePlanPrice(sortedPhases, idx){
  if(!sortedPhases?.length) return null;
  let a=null; sortedPhases.forEach(p=>{ if(idx>=p.fromMonth) a=p.amount });
  return a;
}
function isInCancel(w, idx){ return w?.some?.(x=> idx>=x.fromMonth && idx<=x.toMonth); }

module.exports = withSecurity(async (req, res) => {
  if (req.method !== 'GET') return json(res, { error:'Method Not Allowed' }, 405);

  // 简单 Bearer 认证，避免被他人触发
  const auth = req.headers.authorization || '';
  const token = (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json(res, { error:'Unauthorized' }, 401);
  }

  const ahead = Number(process.env.REMIND_DAYS_AHEAD || 3);
  const users = await redis('smembers', 'users:all') || [];
  const today = new Date(), end = new Date(today.getFullYear(), today.getMonth(), today.getDate()+ahead);

  let sent = 0, examined = 0;

  for (const uid of users) {
    const email = await redis('get', `user:uid:${uid}`);
    if (!email) continue;
    examined++;

    const obj = await redis('hgetall', `items:${uid}`) || {};
    const arr = Object.values(obj).map(v=>{ try{return JSON.parse(v)}catch{return null} }).filter(Boolean);

    const lines = [];

    for (const it of arr) {
      try {
        const start = parseISODate(it.startDate);
        if (it.type === 'warranty') {
          const months = Number(it.warrantyMonths || 0);
          if (months>0){
            const endDate = addMonths(start, months);
            if (endDate >= today && endDate <= end){
              lines.push(`【保修到期】${it.name}：${fmtDate(endDate)} 到期`);
            }
          }
        } else {
          const billingDay = Number(it.billingDay||1);
          // 计算今天到 end 范围内的每个日期，若命中出账日则提醒
          let cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          while(cur <= end){
            const ymIdx = (cur.getFullYear()-start.getFullYear())*12 + (cur.getMonth()-start.getMonth()) + 1;
            if (cur.getDate()===billingDay && ymIdx>=1){
              const sorted = (it.pricePhases||[]).slice().sort((a,b)=>a.fromMonth-b.fromMonth);
              const amount = resolvePlanPrice(sorted, ymIdx);
              if (amount!=null && !isInCancel(it.cancelWindows, ymIdx)){
                const money = Intl.NumberFormat(undefined, { style:'currency', currency: it.currency || 'CNY' }).format(amount);
                lines.push(`【扣费提醒】${it.name}：${fmtDate(cur)} 将扣费 ${money}`);
              }
            }
            cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+1);
          }

          if (it.type==='insurance'){
            const policyMonths = (Number(it.policyTermYears)||0)*12 + (Number(it.policyTermMonths)||0);
            if (policyMonths>0){
              const endDate = addMonths(start, policyMonths);
              if (endDate >= today && endDate <= end){
                lines.push(`【保期到期】${it.name}：${fmtDate(endDate)} 保期结束`);
              }
            }
          }
        }
      } catch {}
    }

    if (lines.length){
      const html = `<p>以下事件将在 ${ahead} 天内发生：</p><ul>${lines.map(li=>`<li>${li}</li>`).join('')}</ul>`;
      try { await sendEmail(email, '费用时间轴 - 提醒', html); sent++; } catch(e){ console.error('sendEmail fail', email, e.message); }
    }
  }

  return json(res, { ok:true, examined, sent, ahead });
}, {
  csrf: false, // 仅 GET + Bearer
  allowedOrigins: [process.env.PUBLIC_ORIGIN].filter(Boolean),
  rateLimit: limitGlobal
});
