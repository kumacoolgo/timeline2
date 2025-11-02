// === 工具 ===
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const COL_W = 110;

let allCloudItems = [];
let items = [];
let activeId = null, editingId = null, ONLINE = false;

// 语言
let LANG = localStorage.getItem('lang') || 'zh';
const LANG_SHORT = { zh:'中', en:'En', ja:'日' };
function setLang(l){
  LANG = ['zh','en','ja'].includes(l) ? l : 'zh';
  localStorage.setItem('lang', LANG);
  const btn = $('#btnLang'); if (btn) btn.textContent = LANG_SHORT[LANG] || '中';
  const menu = $('#langMenu'); if (menu) menu.setAttribute('aria-hidden','true');
  render();
}

// Loader
const $loader = $('#loader');
function showLoader(){ $loader.style.display = 'flex'; }
function hideLoader(){ $loader.style.display = 'none'; }

// 弹窗消息
const $dlgMsg = $('#dlg_msg');
function showDialogMsg(message, ok=false){ $dlgMsg.textContent = message || ''; $dlgMsg.style.color = ok ? '#16a34a' : '#ef4444'; }

// 日期
function pad2(n){return (n<10?'0':'')+n;}
function parseISODate(s){ if(!s) return new Date(); const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function MaxDate(a,b){ return a>b?a:b; }

// === 统一货币显示（无小数 + 固定符号）===
function fmtMoney(amount, currency = 'CNY') {
  const n = Number(amount || 0);
  const locales = { zh:'zh-CN', en:'en-US', ja:'ja-JP' };
  const num = Math.round(n).toLocaleString(locales[LANG] || 'zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const SYMBOL = { CNY: '￥', JPY: 'JP￥', USD: '$', EUR: '€' };
  const sym = SYMBOL[currency] ?? (currency + ' ');
  return `${sym} ${num}`;
}

// 类型相关 UI
function syncTypeUI(){
  const t = $('#f_type').value;
  $('#blockPlan').style.display = (t==='plan'||t==='insurance')?'block':'none';
  $('#blockWarranty').style.display = (t==='warranty')?'block':'none';
  $('#subBlockInsurance').style.display = (t==='insurance')?'block':'none';
  const cycle = $('#f_cycle')?.value || 'monthly';
  const showFiscal = (t==='plan' || t==='insurance') && cycle==='yearly';
  const fiscalWrap = $('#fiscalWrap'); if (fiscalWrap) fiscalWrap.style.display = showFiscal?'flex':'none';
}

// === 表单构建 ===
function addPhase(i){
  const d=document.createElement('div');
  d.className='row-fields';
  d.innerHTML = `
    <span class=small>第</span><input class=m type="number" min=1 value="${i?.fromMonth||1}">
    <span class=small>个月起</span><input class=a type="number" step="0.01" value="${i?.amount||0}">
    <span class=small>/月</span>
    <button class="icon-btn delete-btn del" type="button" aria-label="删除阶段">➖</button>`;
  d.querySelector('.del').onclick=()=>d.remove();
  $('#phaseList').appendChild(d);
}
function addCancel(i){
  const d=document.createElement('div');
  d.className='row-fields';
  d.innerHTML = `
    <span class=small>第</span><input class=fm type="number" min=1 value="${i?.fromMonth||1}">
    <span class=small>-</span><input class=tm type="number" min=1 value="${i?.toMonth||1}">
    <span class=small>个月</span>
    <button class="icon-btn delete-btn del" type="button" aria-label="删除退会期">➖</button>`;
  d.querySelector('.del').onclick=()=>d.remove();
  $('#cancelList').appendChild(d);
}
$('#btnAddPhase').onclick=()=>addPhase();
$('#btnAddCancel').onclick=()=>addCancel();

function readForm(){
  showDialogMsg('', true);
  const type = $('#f_type').value.trim();
  const name = $('#f_name').value.trim();
  const start = $('#f_start').value;
  if(!name){ showDialogMsg('请填写项目名称'); return null; }
  if(!start){ showDialogMsg('请选择开始日期'); return null; }

  const base = {
    type, name, number: $('#f_number').value.trim(), startDate: start,
    currency: $('#f_currency').value || 'CNY',
    category: $('#f_category').value.trim() || '',
    tags: ($('#f_tags').value || '').split(',').map(s=>s.trim()).filter(Boolean)
  };

  const cycle = ($('#f_cycle')?.value || 'monthly');
  const fiscalMonth = Number($('#f_fiscal')?.value || 1);
  const billingDay = 1; // 固定为 1

  if(type==='warranty'){
    return { id:editingId||undefined, ...base, warrantyMonths:Number($('#f_wm').value)||0 };
  }
  const phases = [...$$('#phaseList .row-fields')].map(r=>({
    fromMonth: Number(r.querySelector('.m').value)||1,
    amount: Number(r.querySelector('input.a').value)||0
  })).sort((a,b)=>a.fromMonth-b.fromMonth);
  const cancels = [...$$('#cancelList .row-fields')].map(r=>({
    fromMonth: Number(r.querySelector('.fm').value)||1,
    toMonth: Number(r.querySelector('.tm').value)||1
  }));
  return {
    id:editingId||undefined, ...base,
    billingDay, cycle,
    fiscalMonth: cycle==='yearly' ? fiscalMonth : undefined,
    pricePhases: phases, cancelWindows: cancels,
    policyTermYears: Number($('#f_ins_y').value)||0,
    policyTermMonths: Number($('#f_ins_m').value)||0
  };
}

function fillForm(it){
  $('#f_type').value=it?.type||'plan';
  $('#f_name').value=it?.name||'';
  $('#f_number').value=it?.number||'';
  $('#f_start').value=it?.startDate||'';
  $('#f_wm').value=it?.warrantyMonths||24;
  $('#f_currency').value = it?.currency || 'CNY';
  $('#f_category').value = it?.category || '';
  $('#f_tags').value = (it?.tags||[]).join(', ');
  if ($('#f_cycle')) $('#f_cycle').value = it?.cycle || 'monthly';
  if ($('#f_fiscal')) $('#f_fiscal').value = String(it?.fiscalMonth || (parseISODate(it?.startDate||'').getMonth()+1 || 1));
  $('#phaseList').innerHTML='';
  $('#cancelList').innerHTML='';
  (it?.pricePhases?.length?it.pricePhases:[{fromMonth:1,amount:0}]).forEach(addPhase);
  (it?.cancelWindows||[]).forEach(addCancel);
  $('#f_ins_y').value = it?.policyTermYears || '';
  $('#f_ins_m').value = it?.policyTermMonths || '';
  syncTypeUI();
}

// === 渲染/计算 ===
function resolvePlanPrice(sortedPhases, idx){
  if(!sortedPhases?.length) return null;
  let a=null; sortedPhases.forEach(p=>{ if(idx>=p.fromMonth) a=p.amount });
  return a;
}
function isInCancel(w, idx){ return w?.some?.(x=> idx>=x.fromMonth && idx<=x.toMonth); }
function visibleItems(){ return activeId? items.filter(i=>i.id===activeId) : (items.length?[items[0]]:[]); }

function scrollToToday(behavior='smooth'){
  const today = new Date();
  const ym = `${today.getFullYear()}-${pad2(today.getMonth()+1)}`;
  const gridContainer = $('#gridContainer');
  const head = $(`#gridHead [data-ym="${ym}"]`);
  if(head){
    const target = head.offsetLeft - gridContainer.offsetLeft - 10;
    gridContainer.scrollTo({ left: Math.max(0, target), behavior });
  }
}

// 余额按月扣减，但不改变每月应收金额
// 返回 { amount, remainAfter }
function applyBalanceForMonth(item, sortedPhases, m0, idx) {
  const amount = resolvePlanPrice(sortedPhases, idx);
  const bal = Number(item.balance || 0);
  const fromIdx = Number(item.balanceFrom || 0);

  if (!bal || !fromIdx || idx < fromIdx) {
    return { amount: amount==null?null:amount, remainAfter: bal };
  }

  // 从 balanceFrom 开始，逐月用应收金额扣减余额（不管显示是否在退会期，只有 amount>0 才会扣）
  let remain = bal;
  for (let i = fromIdx; i <= idx; i++) {
    const a = resolvePlanPrice(sortedPhases, i);
    if (a != null && a > 0) {
      remain = Math.max(0, remain - a);
    }
  }
  return { amount: amount==null?null:amount, remainAfter: remain };
}


// 渲染
function render(){
  const term = $('#filter').value.trim().toLowerCase();
  if(!term) items = [...allCloudItems];
  else {
    items = allCloudItems.filter(it=>{
      const hay = [
        it.name, it.type, it.number,
        (it.category||''), ...(it.tags||[])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }
  if(!items.find(it=>it.id===activeId)) activeId = items[0]?.id || null;

  const L = $('#leftWrap');
  L.innerHTML = '';

  const frag = document.createDocumentFragment();
  items.forEach(it=>{
    const typeLabel = it.type === 'plan' ? '<span class="small" style="color:#6b5cff">套餐</span>' :
                      it.type === 'insurance' ? '<span class="small" style="color:#10b981">保险</span>' :
                      '<span class="small" style="color:#3b82f6">保修</span>';

    let subDetail = '';
    if (it.type === 'warranty') {
      if (it.warrantyMonths) subDetail = `<span class="small" style="color:#3b82f6">保修期 ${it.warrantyMonths} 个月</span>`;
    } else if (it.type === 'plan') {
      if (it.cancelWindows?.length>0) subDetail = `<span class="small" style="color:#6b5cff">退会期 第 ${it.cancelWindows[0].fromMonth} 个月</span>`;
    } else if (it.type === 'insurance') {
      const y = it.policyTermYears || 0, m = it.policyTermMonths || 0;
      const termStr = (y>0?`${y}年`:'' ) + (m>0?`${m}个月`:'' );
      if (termStr) subDetail = `<span class="small" style="color:#10b981">保期 ${termStr}</span>`;
    }

    const div = document.createElement('div');
    div.className = `item ${it.id===activeId ? 'active':''}`;
    div.dataset.id = it.id;
    div.setAttribute('draggable', 'true');
    div.innerHTML = `
      <div>
        <div class="title item-line-1">
          <span>${(it.name||'')}</span>
          ${typeLabel}
          <span class="meta item-number">#${it.number||'-'}</span>
        </div>
        <div class="meta item-line-2">
          <span>开始: ${it.startDate || '-'}</span>
          ${it.category ? `<span style="margin-left:8px;">· ${it.category}</span>` : ''}
          ${(it.tags?.length? `<span style="margin-left:8px;">· ${it.tags.join('/')}</span>`:'')}
        </div>
        <div class="meta item-line-3">${subDetail}</div>
      </div>
      <div class="ops">
        <button class="ghost btnEdit" type="button">编辑</button>
      </div>
    `;
    div.addEventListener('click', e=>{ if(e.target.closest('button')) return; activeId = it.id; render(); });
    div.querySelector('.btnEdit').onclick = e => {
      e.stopPropagation();
      editingId = it.id;
      fillForm(allCloudItems.find(x=>x.id===it.id));
      showDialogMsg('', true);
      $('#dlgTitle').textContent='编辑项目';
      $('#btnDeleteInDialog').style.display = 'inline-block';
      $('#dlg').style.display='flex';
    };

    // DnD 排序
    div.addEventListener('dragstart', e=>{
      div.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', it.id);
    });
    div.addEventListener('dragend', ()=> div.classList.remove('dragging'));
    frag.appendChild(div);
  });
  L.appendChild(frag);

  // dragover 放置效果与重排
  L.addEventListener('dragover', e=>{
    e.preventDefault();
    const after = getDragAfterElement(L, e.clientY);
    const dragging = L.querySelector('.dragging');
    if(!dragging) return;
    if(after == null) L.appendChild(dragging);
    else L.insertBefore(dragging, after);
  }, { passive:false });

  L.addEventListener('drop', async e=>{
    e.preventDefault();
    const orderIds = Array.from(L.querySelectorAll('.item')).map(el=>el.dataset.id);
    const newAll = [];
    orderIds.forEach(id=>{
      const obj = allCloudItems.find(x=>x.id===id);
      if (obj) newAll.push(obj);
    });
    allCloudItems = newAll;
    const updates = [];
    allCloudItems.forEach((it, idx)=>{
      const newOrder = idx+1;
      if (it.order !== newOrder){
        it.order = newOrder;
        updates.push(api(`/api/items?id=${it.id}`, {
          method:'PUT',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({ order:newOrder })
        }));
      }
    });
    showLoader();
    try{ if (updates.length) await Promise.all(updates); }
    catch (err){ alert('保存排序失败: ' + err.message); }
    finally { await loadCloudItems(); }
  });

  // 右侧时间轴
  const data = visibleItems();
  const head = $('#gridHead'), grid = $('#grid');
  if(!data.length){
    head.innerHTML=''; grid.innerHTML='<div class=small>请在左侧选择一个项目，或点击“添加项目”。</div>'; return;
  }

  const it = data[0];
  const minStart = startOfMonth(parseISODate(it.startDate||null));
  const today = new Date();
  const todayPlusOneYear = addMonths(today, 12);
  let maxEndCandidate = MaxDate(todayPlusOneYear, minStart);
  const itemStartDate = parseISODate(it.startDate);
  const sortedPricePhases = (it.pricePhases || []).filter(p => p.amount != null).sort((a,b)=>a.fromMonth-b.fromMonth);

  if (it.type==='plan' || it.type==='insurance'){
    if (sortedPricePhases.length){
      const lastPhase = sortedPricePhases[sortedPricePhases.length-1];
      const lastPhaseMonth = (lastPhase.fromMonth || 1) - 1;
      const lastPhaseDate = addMonths(itemStartDate, lastPhaseMonth);
      maxEndCandidate = MaxDate(maxEndCandidate, addMonths(lastPhaseDate, 12));
    }
    if (it.cancelWindows?.length){
      const lastWindow = [...it.cancelWindows].sort((a,b)=>b.toMonth-a.toMonth)[0];
      const lastWindowMonth = (lastWindow.toMonth || 1) - 1;
      const lastWindowDate = addMonths(itemStartDate, lastWindowMonth);
      maxEndCandidate = MaxDate(maxEndCandidate, addMonths(lastWindowDate, 12));
    }
    if (it.type==='insurance'){
      const policyMonths = (Number(it.policyTermYears)||0)*12 + (Number(it.policyTermMonths)||0);
      if (policyMonths>0){
        const endDate = addMonths(itemStartDate, policyMonths);
        maxEndCandidate = MaxDate(maxEndCandidate, addMonths(endDate, 12));
      }
    }
  } else if (it.type==='warranty'){
    const wm = Number(it.warrantyMonths)||0;
    if (wm>0){
      const endDate = addMonths(itemStartDate, wm);
      maxEndCandidate = MaxDate(maxEndCandidate, addMonths(endDate, 12));
    }
  }
  let maxEnd = startOfMonth(maxEndCandidate);

  const mlist=[]; let cur = new Date(minStart);
  while(cur<=maxEnd){ mlist.push(new Date(cur)); cur = addMonths(cur,1); }

  head.style.gridTemplateColumns=`repeat(${mlist.length}, ${COL_W}px)`;
  const todayY=today.getFullYear(), todayM=today.getMonth();

  head.innerHTML = mlist.map(m=>{
    const q=Math.ceil((m.getMonth()+1)/3);
    const ym = `${m.getFullYear()}-${pad2(m.getMonth()+1)}`;
    const isTodayMonth = (m.getFullYear()===todayY && m.getMonth()===todayM);
    return `<div class="cell nowrap ${isTodayMonth?'today-month':''}" data-ym="${ym}" style="text-align:center;">
      <div><div><b>${m.getFullYear()}-${pad2(m.getMonth()+1)}</b></div><div class=small>Q${q}</div></div>
    </div>`;
  }).join('');

  grid.style.gridTemplateColumns=`repeat(${mlist.length}, ${COL_W}px)`;
  const m0 = startOfMonth(parseISODate(it.startDate));
  const MonthIndex = d => (d.getFullYear()-m0.getFullYear())*12 + d.getMonth()-m0.getMonth() + 1;

  const cells=[];
  const cycle = it.cycle || 'monthly';
  const fiscalMonth = Number(it.fiscalMonth || (parseISODate(it.startDate).getMonth()+1));
  for(let i=0;i<mlist.length;i++){
    const idx = MonthIndex(mlist[i]);
    const m = mlist[i];
    const isTodayMonth = (m.getFullYear()===todayY && m.getMonth()===todayM);
    const isFiscalMonth = (cycle==='yearly') ? ((m.getMonth()+1) === fiscalMonth) : true;
    const contentDivStart = `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;">`;
    const contentDivEnd = `</div>`;

    if(it.type==='warranty'){
      const wm = Number(it.warrantyMonths||0);
      let badge = '';
      if (idx>=1 && idx<=wm) badge = '<span class="badge">保修中</span>';
      else if (idx>wm && wm>0) badge = '<span class="badge cancel">保修外</span>';
      cells.push(`<div class="cell ${isTodayMonth?'today-month':''}" data-idx="${idx}" style="text-align:center;">${contentDivStart}${badge}${contentDivEnd}</div>`);
    } else {
      // 计算抵扣后的显示金额 + 剩余余额
	// 计算本月应收金额 + 余额剩余
	const { amount, remainAfter } = applyBalanceForMonth(it, sortedPricePhases, m0, idx);
	const cancel = isInCancel(it.cancelWindows, idx);
	let segClass = '';
	if (amount != null){
	  let seg=0;
	  for(let j=0;j<sortedPricePhases.length;j++){ if(idx>=sortedPricePhases[j].fromMonth) seg=j; }
	  segClass = (seg%2===0)?'amount-segment-1':'amount-segment-2';
	}
	const amountHtml = (amount!=null && isFiscalMonth)
	  ? `<div class="badge ${segClass} editable-amount" title="点击修改">${fmtMoney(amount, it.currency||'CNY')}</div>`
	  : (isFiscalMonth ? `<div class="badge editable-amount" style="opacity:.6" title="点击新增或修改">—</div>` : '');

	const balanceHtml = (Number(it.balance||0)>0 && isFiscalMonth)
	  ? `<div class="small" style="margin-top:2px;color:#667085">余额：${fmtMoney(Math.max(0, remainAfter), it.currency||'CNY')}</div>`
  : '';

      const cancelHtml = cancel? `<div class="badge cancel">退会期</div>` : '';
      cells.push(`<div class="cell ${isTodayMonth?'today-month':''}" data-idx="${idx}" style="text-align:center; cursor:pointer;">${contentDivStart}${amountHtml}${balanceHtml}${cancelHtml}${contentDivEnd}</div>`);
    }
  }
  grid.innerHTML = cells.join('');

  setTimeout(()=>scrollToToday('auto'),0);

  // 金额就地编辑（支持余额）
  const curItem = data[0];
  if (curItem.type!=='warranty'){
    $$('#grid .cell').forEach(cell=>{
      const idx = Number(cell.getAttribute('data-idx')||0);
      if (!idx) return;
      cell.addEventListener('click', async (e)=>{
        if (!e.currentTarget.contains(e.target)) return;
        const sorted = (curItem.pricePhases || []).slice().sort((a,b)=>a.fromMonth-b.fromMonth);
        const curAmount = resolvePlanPrice(sorted, idx);
        const input = prompt(`设置从第 ${idx} 个月起（直到下一阶段前）的金额：`, curAmount!=null? String(curAmount) : '');
        if (input==null) return;
        let newAmount = Number(input);
        if (Number.isNaN(newAmount) || newAmount<0){ alert('金额必须是非负数字'); return; }

        // 第二个输入：余额（可选）
        const hasExistingBal = Number(curItem.balance||0)>0 && idx >= Number(curItem.balanceFrom||Infinity);
        const balInput = prompt('可选：设置余额（从本月开始按月抵扣，留空不变，0 取消余额）', hasExistingBal ? String(curItem.balance) : '');
        let balancePatch = {};
        if (balInput !== null) {
          const trimmed = balInput.trim();
          if (trimmed==='') {
            // 不改
          } else {
            const bal = Math.max(0, Number(trimmed));
            if (Number.isNaN(bal)) { alert('余额需为数字'); return; }
            balancePatch = { balance: bal, balanceFrom: idx };
          }
        }

        const nextStart = (()=>{ const later = sorted.filter(p=>p.fromMonth>idx).map(p=>p.fromMonth); return later.length? Math.min(...later): Infinity; })();
        const updated = updatePhasesForEdit(sorted, idx, newAmount, nextStart);

        try{
          showLoader();
          await api('/api/items?id='+curItem.id, {
            method:'PUT',
            headers:{'content-type':'application/json'},
            body: JSON.stringify({ pricePhases: updated, ...balancePatch })
          });
          await loadCloudItems();
        }catch(err){
          hideLoader();
          alert('保存失败：'+(err.message||err));
        }
      });
    });
  }
}

function getDragAfterElement(container, y){
  const els = [...container.querySelectorAll('.item:not(.dragging)')];
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height/2);
    if (offset<0 && offset>closest.offset) return { offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 将“点击第 T 个月 → 设置金额 A”转换为 pricePhases
function updatePhasesForEdit(phases, T, A, nextStart){
  const sorted = (phases||[]).slice().sort((a,b)=>a.fromMonth-b.fromMonth);
  const prevAmount = resolvePlanPrice(sorted, T);
  if (prevAmount === A) return sorted;

  const before = sorted.filter(p=>p.fromMonth < T);
  const after  = sorted.filter(p=>p.fromMonth >= nextStart);

  let mid = [];
  const hasT = sorted.find(p=>p.fromMonth===T);
  if (hasT) {
    mid = [{ fromMonth:T, amount:A }];
  } else {
    const lastBefore = before[before.length-1];
    if (!lastBefore || lastBefore.amount !== A) mid.push({ fromMonth:T, amount:A });
  }
  const out = [...before, ...mid, ...after];
  const merged = out
    .filter(Boolean)
    .sort((a,b)=>a.fromMonth-b.fromMonth)
    .reduce((acc,p)=>{
      const last = acc[acc.length-1];
      if (last && last.amount===p.amount) return acc;
      acc.push(p); return acc;
    }, []);
  return merged;
}

// 事件绑定 - 弹窗
$('#f_type').onchange=syncTypeUI;
$('#f_cycle')?.addEventListener('change', syncTypeUI);

$('#btnAdd').onclick=()=>{
  editingId=null;
  fillForm(null);
  showDialogMsg('', true);
  $('#dlgTitle').textContent='新增项目';
  $('#btnDeleteInDialog').style.display='none';
  $('#dlg').style.display='flex';
};
$('#btnClose').onclick=()=>$('#dlg').style.display='none';
$('#btnCancel').onclick=()=>$('#dlg').style.display='none';
$('#dlg').addEventListener('click',e=>{ if(e.target.id==='dlg') $('#dlg').style.display='none'; });

$('#btnSave').onclick= async ()=>{
  showDialogMsg('', true);
  const it = readForm();
  if(!it) return;

  $('#btnSave').disabled = true;
  showLoader();
  try{
    if (editingId){
      const updated = { ...it, id: editingId };
      await api('/api/items?id='+editingId, {
        method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(updated)
      });
    } else {
      await api('/api/items', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(it) });
    }
    $('#dlg').style.display='none';
    await loadCloudItems();
  } catch(e){
    showDialogMsg(e.message || '保存失败');
    hideLoader();
  } finally { $('#btnSave').disabled = false; }
};

$('#btnDeleteInDialog').onclick = async ()=>{
  if (!editingId) return;
  if (!confirm('确定要删除该项目吗？此操作无法撤销。')) return;
  const b = $('#btnDeleteInDialog'); b.disabled=true;
  showDialogMsg('', true); showLoader();
  try{
    await api('/api/items?id='+editingId, { method:'DELETE' });
    $('#dlg').style.display='none';
    await loadCloudItems();
  } catch(e){
    showDialogMsg(e.message || '删除失败');
    hideLoader();
  } finally { b.disabled=false; }
};

$('#btnToday').onclick = ()=> scrollToToday('smooth');
$('#btnClearSearch').onclick = ()=> {
  $('#filter').value='';
  render();
  $('#filter').focus();
};

// 语言切换事件
$('#btnLang')?.addEventListener('click', ()=>{
  const menu = $('#langMenu');
  const opened = menu.getAttribute('aria-hidden') === 'false';
  menu.setAttribute('aria-hidden', opened ? 'true' : 'false');
  $('#btnLang').setAttribute('aria-expanded', opened ? 'false' : 'true');
});
$('#langMenu')?.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-lang]');
  if (!btn) return;
  setLang(btn.getAttribute('data-lang'));
});

// === 自动搜索（防抖 & 兼容中文输入法）===
const SEARCH_DEBOUNCE_MS = 200;
let searchTimer = null;
let isComposing = false;

$('#filter').addEventListener('compositionstart', ()=>{ isComposing = true; });
$('#filter').addEventListener('compositionend', ()=>{
  isComposing = false;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, SEARCH_DEBOUNCE_MS);
});
$('#filter').addEventListener('input', ()=>{
  if (isComposing) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, SEARCH_DEBOUNCE_MS);
});

// 导出/导入/统计
$('#btnExport').onclick = async ()=>{
  try{
    showLoader();
    const data = await api('/api/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = `expense-timeline-export-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch(e){ alert('导出失败：'+(e.message||e)); }
  finally{ hideLoader(); }
};
$('#btnImport').onclick = ()=> $('#fileImport').click();
$('#fileImport').onchange = async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const json = JSON.parse(text);
    if(!Array.isArray(json)) return alert('JSON 格式不正确：应为数组');
    showLoader();
    await api('/api/import', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ items: json }) });
    await loadCloudItems();
    alert('导入成功');
  } catch(err){
    alert('导入失败：'+(err.message||err));
  } finally {
    e.target.value = '';
    hideLoader();
  }
};
$('#btnStats').onclick = ()=>{
  const c = $('#statsContent');
  c.innerHTML = buildStatsHTML(allCloudItems);
  $('#dlgStats').style.display='flex';
};
$('#btnCloseStats').onclick = ()=> $('#dlgStats').style.display='none';
$('#dlgStats').addEventListener('click',e=>{ if(e.target.id==='dlgStats') $('#dlgStats').style.display='none'; });

function buildStatsHTML(arr){
  const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const months = Array.from({length:12}, (_,i)=> addMonths(start, i));

  const totals = new Map();
  const byCategory = new Map();

  for(const it of arr){
    const currency = it.currency || 'CNY';
    if(!totals.has(currency)) totals.set(currency, Array(12).fill(0));
    if(!byCategory.has(currency)) byCategory.set(currency, new Map());

    const itemStart = parseISODate(it.startDate);
    const m0 = startOfMonth(itemStart);
    const MonthIndex = d => (d.getFullYear()-m0.getFullYear())*12 + d.getMonth()-m0.getMonth() + 1;
    const sorted = (it.pricePhases||[]).slice().sort((a,b)=>a.fromMonth-b.fromMonth);

    for(let i=0;i<12;i++){
      const idx = MonthIndex(months[i]);
      let val = 0;
      if (it.type!=='warranty'){
        // 统计中也考虑余额抵扣
        const amountInfo = applyBalanceForMonth(it, sorted, m0, idx);
        const rawAmount = amountInfo.amount;

        // 仍然跳过退会期
        if (rawAmount != null && !isInCancel(it.cancelWindows, idx)) val = rawAmount;
        if (charge!=null && !isInCancel(it.cancelWindows, idx)) val = charge;
      }
      totals.get(currency)[i] += val;

      if(val>0){
        const cat = it.category || '未分类';
        const map = byCategory.get(currency);
        map.set(cat, (map.get(cat)||0) + val);
      }
    }
  }

  const sectionMonths = [...totals.entries()].map(([cur, arr])=>{
    const rows = arr.map((v,i)=> `<tr><td>${months[i].getFullYear()}-${pad2(months[i].getMonth()+1)}</td><td style="text-align:right">${fmtMoney(v, cur)}</td></tr>`).join('');
    return `<div class="card"><b>未来12个月总额（${cur}）</b><table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr><th style="text-align:left">月份</th><th style="text-align:right">合计</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');

  const sectionCats = [...byCategory.entries()].map(([cur, map])=>{
    const rows = [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=> `<tr><td>${k}</td><td style="text-align:right">${fmtMoney(v, cur)}</td></tr>`).join('');
    return `<div class="card"><b>分类汇总（${cur}）</b><table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr><th style="text-align:left">分类</th><th style="text-align:right">合计</th></tr></thead><tbody>${rows||'<tr><td colspan=2 class="small">暂无数据</td></tr>'}</tbody></table></div>`;
  }).join('');

  return `<div class="row" style="flex-direction:column;gap:10px">${sectionMonths}${sectionCats}</div>`;
}

// === API 封装（含 CSRF 与错误统一） ===
function getCookie(name){
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function csrfToken(){ return getCookie('__Host-csrf') || getCookie('csrf'); }

async function api(path, init){
  const method = (init?.method || 'GET').toUpperCase();
  const isWrite = ['POST','PUT','PATCH','DELETE'].includes(method);
  const headers = Object.assign({}, init?.headers || {});
  headers['X-Requested-With'] = 'XMLHttpRequest';
  if (isWrite) headers['X-CSRF-Token'] = csrfToken();

  const r = await fetch(path, { credentials:'include', ...init, headers });
  const text = await r.text();
  let data; try{ data = JSON.parse(text||'{}'); }catch{ data = { error:text||'网络错误' }; }

  if(!r.ok){
    const isAuthPath = ['/api/login','/api/register','/api/register-send-code','/api/password-reset-send-code','/api/password-reset-confirm','/api/csrf'].includes(path);
    if ((r.status===400) && isAuthPath) throw new Error(data.error || '操作失败，请检查输入');
    if (r.status===429) throw new Error(data.error || '请求过于频繁，请稍后再试');
    if (r.status===403){ throw new Error(data.error || '安全验证失败，请刷新页面'); }
    if (r.status===401 && !isAuthPath){
      ONLINE=false; $('#btnUser').textContent='登录/注册'; $('#btnLogout').style.display='none';
      DlgAuth.show('login'); hideLoader();
    }
    const msg = data.reason ? `${data.error} (${data.reason})` : (data.error || `HTTP ${r.status}`);
    throw new Error(msg);
  }
  return data;
}

// 认证弹窗
const DlgAuth = {
  el: $('#dlgAuth'),
  views: { login: $('#viewLogin'), register: $('#viewRegister'), reset: $('#viewReset') },
  msgs:  { login: $('#login_msg'), register: $('#reg_msg'), reset: $('#reset_msg') },
  show(view='login'){ this.switchView(view); this.el.style.display='flex'; },
  hide(){ this.el.style.display='none'; },
  switchView(view){ Object.values(this.views).forEach(v=>v.classList.remove('active')); Object.values(this.msgs).forEach(m=>m.textContent=''); if(this.views[view]) this.views[view].classList.add('active'); },
  showMsg(view, message, ok=false){ if(this.msgs[view]){ this.msgs[view].textContent=message; this.msgs[view].style.color= ok?'#16a34a':'#ef4444'; } },
  startCountdown(btn){
    let sec=60; btn.disabled=true; const txt=btn.textContent; btn.textContent=`重新发送 (${sec}s)`;
    const timer=setInterval(()=>{ sec--; if(sec<=0){ clearInterval(timer); btn.textContent=txt; btn.disabled=false; } else btn.textContent=`重新发送 (${sec}s)`; },1000);
  }
};
$('#btnUser').onclick = ()=>{ $('#login_em').value=''; $('#login_pw').value=''; $('#reg_em').value=''; $('#reg_pw').value=''; $('#reg_code').value=''; $('#reset_em').value=''; $('#reset_code').value=''; $('#reset_pw').value=''; DlgAuth.show('login'); };
$('#btnAuthCancel').onclick = ()=> DlgAuth.hide();
$('#btnRegCancel').onclick = ()=> DlgAuth.hide();
$('#btnResetCancel').onclick = ()=> DlgAuth.hide();
$('#btnGoReg').onclick = ()=> DlgAuth.switchView('register');
$('#btnGoLogin').onclick = ()=> DlgAuth.switchView('login');
$('#btnGoLoginReset').onclick = ()=> DlgAuth.switchView('login');
$('#btnGoReset').onclick = ()=> DlgAuth.switchView('reset');

$('#btnLogout').onclick = async ()=>{
  if(!confirm('确定要登出吗？')) return;
  showLoader();
  try{ await api('/api/logout', { method:'POST' }); location.reload(); }
  catch(e){ alert('登出失败: '+e.message); hideLoader(); }
};

// === 启动：确保 CSRF + 检查登录 ===
async function ensureCsrf(){
  if (!getCookie('__Host-csrf') && !getCookie('csrf')){
    try{ await fetch('/api/csrf', { method:'GET', credentials:'include' }); } catch {}
  }
}
async function loadCloudItems(){
  showLoader();
  try{
    allCloudItems = await api('/api/items');
    allCloudItems.sort((a,b)=>(a.order||0)-(b.order||0));
    if(allCloudItems.length>0 && !allCloudItems.find(it=>it.id===activeId)) activeId = allCloudItems[0].id;
    render();
  } catch(e){ console.error('加载数据失败:', e.message); }
  finally{ hideLoader(); }
}
async function checkLogin(){
  showLoader();
  try{
    const me = await api('/api/me');
    ONLINE=true; $('#btnUser').textContent = me.email; $('#btnLogout').style.display='inline-block';
    await loadCloudItems();
  } catch(e){
    ONLINE=false; $('#btnUser').textContent='登录/注册'; DlgAuth.show('login'); hideLoader();
  }
}

async function bootstrap(){
  setLang(LANG); // 初始化按钮文字
  await ensureCsrf();
  checkLogin();
}
bootstrap();

// ====== 登录/注册/重置交互 ======
$('#btnSendRegCode').onclick = async ()=>{
  const btn = $('#btnSendRegCode');
  const email = $('#reg_em').value.trim();
  if(!email) return DlgAuth.showMsg('register','请输入邮箱');
  btn.disabled=true; DlgAuth.showMsg('register','发送中...', true);
  try{
    const d = await api('/api/register-send-code', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email }) });
    DlgAuth.showMsg('register', d.message || '验证码已发送', true);
    DlgAuth.startCountdown(btn);
  }catch(e){ DlgAuth.showMsg('register', e.message || '发送失败'); btn.disabled=false; }
};
$('#goReg').onclick = async ()=>{
  const b=$('#goReg'); b.disabled=true; DlgAuth.showMsg('register','');
  try{
    const email=$('#reg_em').value.trim(), password=$('#reg_pw').value, code=$('#reg_code').value.trim();
    await api('/api/register', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email, password, code }) });
    DlgAuth.showMsg('register','注册成功，请返回登录', true);
  }catch(e){ DlgAuth.showMsg('register', e.message || '注册失败'); }
  finally{ b.disabled=false; }
};
$('#goLogin').onclick = async ()=>{
  const b=$('#goLogin'); b.disabled=true; DlgAuth.showMsg('login',''); showLoader();
  try{
    await api('/api/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:$('#login_em').value.trim(), password:$('#login_pw').value }) });
    const me = await api('/api/me');
    ONLINE=true; $('#btnUser').textContent = me.email; $('#btnLogout').style.display='inline-block'; DlgAuth.hide(); await loadCloudItems();
  }catch(e){ DlgAuth.showMsg('login', e.message || '登录失败'); hideLoader(); }
  finally{ b.disabled=false; }
};
$('#btnSendResetCode').onclick = async ()=>{
  const btn=$('#btnSendResetCode'); const email=$('#reset_em').value.trim();
  if(!email) return DlgAuth.showMsg('reset','请输入注册邮箱');
  btn.disabled=true; DlgAuth.showMsg('reset','发送中...', true);
  try{
    const d = await api('/api/password-reset-send-code', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email }) });
    DlgAuth.showMsg('reset', d.message || '验证码已发送', true);
    DlgAuth.startCountdown(btn);
  }catch(e){ DlgAuth.showMsg('reset', e.message || '发送失败'); btn.disabled=false; }
};
$('#goReset').onclick = async ()=>{
  const b=$('#goReset'); b.disabled=true; DlgAuth.showMsg('reset','');
  try{
    const email=$('#reset_em').value.trim(), code=$('#reset_code').value.trim(), newPassword=$('#reset_pw').value;
    await api('/api/password-reset-confirm', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, code, newPassword }) });
    DlgAuth.showMsg('reset','密码重置成功，请返回登录', true);
  }catch(e){ DlgAuth.showMsg('reset', e.message || '重置失败'); }
  finally{ b.disabled=false; }
};
