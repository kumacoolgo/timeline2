// === 工具 ===
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const COL_W = 110;
let allCloudItems = [];
let items = [];
let activeId = null, editingId = null, ONLINE = false;
// 语言
let LANG = localStorage.getItem('lang') || 'zh';
const LANG_SHORT = { zh:'中', en:'En', ja:'日' };

// --- 安全工具：HTML 转义 (防止 XSS) ---
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- i18n 词典 ---
const I18N = {
  zh: {
    title:'费用时间轴',
    login_register:'登录/注册', logout:'登出',
    search_placeholder:'搜索项目/类型/编号/标签/分类...',
    clear:'清空', this_month:'本月', add_item:'添加项目',
    import:'导入', export:'导出', stats:'统计',
    dialog_edit:'编辑项目', type_plan:'套餐', type_warranty:'保修', type_insurance:'保险',
    name_placeholder:'项目名称', number_placeholder:'编号/卡号(可选)',
    label_start:'开始日', label_currency:'货币',
    category_placeholder:'分类（可选）', tags_placeholder:'标签，用逗号分隔（可选）',
    label_cycle:'周期', cycle_monthly:'月度', cycle_yearly:'年次',
    label_fiscal:'决算月', legend_amount:'金额（从第 X 个月起，金额 / 月）',
    legend_cancel:'退会（从第 X ～ 第 Y 个月为退会期）',
    label_term:'保期', years_placeholder:'年', months_placeholder:'月',
    label_warranty_months:'保修期（月）',
    delete:'删除', cancel:'取消', save:'保存',
    stats_title:'统计与汇总',
    login:'登录', register:'注册', forgot_pwd:'忘记密码？',
    back_login:'返回登录', confirm_register:'确认注册',
    reset_pwd:'重置密码', email:'邮箱', password:'密码', password10:'密码（≥10位）',
    reg_email:'注册邮箱', new_password10:'新密码（≥10位）', confirm_reset:'确认重置',
    code6:'6位验证码', send_code:'发送验证码',
    left_hint:'请在左侧选择一个项目，或点击“添加项目”。',
    plan_label:'套餐', insurance_label:'保险', warranty_label:'保修',
    in_warranty:'保修中', out_warranty:'保修外', cancel_period:'退会期',
    balance_prefix:'余额：',
    prompt_amount:(idx,cur)=>`设置从第 ${idx} 个月起（直到下一阶段前）的金额：`,
    prompt_balance:(has)=> has ?
      '可选：设置余额（从本月开始逐月显示剩余，留空不变，0 清除）' : '可选：设置余额（从本月开始逐月显示剩余）',
    err_amount:'金额必须是非负数字',
    err_load:'加载数据失败：',
    plan_cancel_start:(m)=>`退会开始月：第 ${m} 个月`,
    warranty_end_month:(m)=>`保修终了月：第 ${m} 个月`,
    insurance_expire_month:(m)=>`保险到期月：第 ${m} 个月`,
  },
  en: {
    title:'Expense Timeline',
    login_register:'Sign in / Sign up', logout:'Sign out',
    search_placeholder:'Search name/type/number/tag/category...',
    clear:'Clear', this_month:'This month', add_item:'Add item',
    import:'Import', export:'Export', stats:'Stats',
    dialog_edit:'Edit Item', type_plan:'Plan', type_warranty:'Warranty', type_insurance:'Insurance',
    name_placeholder:'Item name', number_placeholder:'No./Card (optional)',
    label_start:'Start', label_currency:'Currency',
    category_placeholder:'Category (optional)', tags_placeholder:'Tags, comma-separated (optional)',
    label_cycle:'Cycle', cycle_monthly:'Monthly', cycle_yearly:'Yearly',
    label_fiscal:'Fiscal Month', legend_amount:'Amount (from month X, amount / month)',
    legend_cancel:'Cancel window (from month X to month Y)',
    label_term:'Term', years_placeholder:'Years', months_placeholder:'Months',
    label_warranty_months:'Warranty (months)',
    delete:'Delete', cancel:'Cancel', save:'Save',
    stats_title:'Statistics',
    login:'Login', register:'Register', forgot_pwd:'Forgot password?',
    back_login:'Back', confirm_register:'Create account',
    reset_pwd:'Reset Password', email:'Email', password:'Password', password10:'Password (≥10 chars)',
    reg_email:'Registered email', new_password10:'New password (≥10 chars)', confirm_reset:'Confirm reset',
    code6:'6-digit code', send_code:'Send code',
    left_hint:'Pick an item on the left, or click “Add item”.',
    plan_label:'Plan', insurance_label:'Insurance', warranty_label:'Warranty',
    in_warranty:'In warranty', out_warranty:'Out of warranty', cancel_period:'Cancel window',
    balance_prefix:'Balance: ',
    prompt_amount:(idx,cur)=>`Set amount from month ${idx} (until next phase):`,
    prompt_balance:(has)=> has ?
      'Optional balance (starts this month; empty = unchanged, 0 = clear)' : 'Optional balance (starts this month)',
    err_amount:'Amount must be a non-negative number',
    err_load:'Failed to load: ',
    plan_cancel_start:(m)=>`Cancel window start: month ${m}`,
    warranty_end_month:(m)=>`Warranty ends: month ${m}`,
    insurance_expire_month:(m)=>`Policy expires: month ${m}`,
  },
  ja: {
    title:'費用タイムライン',
    login_register:'ログイン/登録', logout:'ログアウト',
    search_placeholder:'項目/タイプ/番号/タグ/カテゴリを検索…',
    clear:'クリア', this_month:'今月', add_item:'項目を追加',
    import:'インポート', export:'エクスポート', stats:'統計',
    dialog_edit:'項目を編集', type_plan:'プラン', type_warranty:'保証', type_insurance:'保険',
    name_placeholder:'項目名', number_placeholder:'番号/カード(任意)',
    label_start:'開始日', label_currency:'通貨',
    category_placeholder:'カテゴリ（任意）', tags_placeholder:'タグ（カンマ区切り・任意）',
    label_cycle:'周期', cycle_monthly:'月次', cycle_yearly:'年次',
    label_fiscal:'決算月', legend_amount:'金額（第Xヶ月から、月額）',
    legend_cancel:'退会期間（第X～第Yヶ月）',
    label_term:'契約期間', years_placeholder:'年', months_placeholder:'月',
    label_warranty_months:'保証期間（月）',
    delete:'削除', cancel:'キャンセル', save:'保存',
    stats_title:'統計',
    login:'ログイン', register:'登録', forgot_pwd:'パスワードをお忘れですか？',
    back_login:'戻る', confirm_register:'登録を確定',
    reset_pwd:'パスワード再設定', email:'メール', password:'パスワード', password10:'パスワード（10文字以上）',
    reg_email:'登録メール', new_password10:'新しいパスワード（10文字以上）', confirm_reset:'再設定',
    code6:'6桁コード', send_code:'コード送信',
    left_hint:'左から項目を選択するか、「項目を追加」をクリックしてください。',
    plan_label:'プラン', insurance_label:'保険', warranty_label:'保証',
    in_warranty:'保証内', out_warranty:'保証外', cancel_period:'退会期間',
    balance_prefix:'残高：',
    prompt_amount:(idx,cur)=>`第 ${idx} ヶ月からの金額を設定：`,
    prompt_balance:(has)=> has ? '任意：残高（当月から表示・空欄は変更なし、0でクリア）' : '任意：残高（当月から表示）',
    err_amount:'金額は 0 以上の数値で入力してください',
    err_load:'読み込みに失敗しました：',
    plan_cancel_start:(m)=>`退会開始月：第 ${m} ヶ月`,
    warranty_end_month:(m)=>`保証終了月：第 ${m} ヶ月`,
    insurance_expire_month:(m)=>`満期月：第 ${m} ヶ月`,
  }
};

// 应用 i18n：替换文本/占位符
function applyI18n(){
  const dict = I18N[LANG] || I18N.zh;
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : (LANG === 'ja' ? 'ja-JP' : 'en');
  // 普通文本
  $$('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    if (k && dict[k]) el.textContent = dict[k];
  });
  // placeholder
  $$('[data-i18n-placeholder]').forEach(el=>{
    const k = el.getAttribute('data-i18n-placeholder');
    if (k && dict[k]) el.setAttribute('placeholder', dict[k]);
  });
  // 按钮简写
  const btn = $('#btnLang'); if (btn) btn.textContent = ({zh:'中', en:'En', ja:'日'})[LANG] || '中';
}

// 设置语言
function setLang(l){
  LANG = ['zh','en','ja'].includes(l) ? l : 'zh';
  localStorage.setItem('lang', LANG);
  applyI18n();
  const menu = $('#langMenu');
  if (menu) menu.setAttribute('aria-hidden','true');
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

// === 统一货币显示（无小数 + 固定符号；与语言无关）===
function fmtMoney(amount, currency = 'CNY') {
  const n = Number(amount || 0);
  const num = Math.round(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const SYMBOL = { CNY: '￥', JPY: 'JP￥', USD: '$', EUR: '€' };
  const sym = SYMBOL[currency] ?? (currency + ' ');
  return `${sym} ${num}`;
}

// 类型相关 UI
function syncTypeUI(){
  const t = $('#f_type').value;
  $('#blockPlan').style.display = (t==='plan'||t==='insurance')?'block':'none';
  $('#blockWarranty').style.display = (t==='warranty')?'block':'none';

  // 周期 & 决算月
  const cycle = $('#f_cycle')?.value || 'monthly';
  const showFiscal = (t==='plan' || t==='insurance') && cycle==='yearly';
  const fiscalWrap = $('#fiscalWrap'); 
  if (fiscalWrap) fiscalWrap.style.display = showFiscal ? 'flex' : 'none';

  // 保险：显示保期，隐藏退会；套餐/保修：隐藏保期，显示退会
  const subIns = $('#subBlockInsurance');
  if (subIns) subIns.style.display = (t === 'insurance') ? 'block' : 'none';

  const cancelFs = $('#cancelFieldset');
  if (cancelFs) cancelFs.style.display = (t === 'insurance') ? 'none' : 'block';
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
  const dict = I18N[LANG];
  showDialogMsg('', true);
  const type = $('#f_type').value.trim();
  const name = $('#f_name').value.trim();
  const start = $('#f_start').value;
  if(!name){ showDialogMsg(dict.name_placeholder); return null; }
  if(!start){ showDialogMsg(dict.label_start); return null; }

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
  const dict = I18N[LANG] || I18N.zh;

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
    const typeLabel = it.type === 'plan' ? `<span class="small" style="color:#6b5cff">${dict.plan_label}</span>` :
                      it.type === 'insurance' ? `<span class="small" style="color:#10b981">${dict.insurance_label}</span>` :
                      `<span class="small" style="color:#3b82f6">${dict.warranty_label}</span>`;

    // “开始日右边”的信息
    let rightInfo = '';
    if (it.type === 'plan' && it.cancelWindows?.length > 0) {
      const first = [...it.cancelWindows].sort((a,b)=>a.fromMonth-b.fromMonth)[0].fromMonth;
      if (dict.plan_cancel_start) rightInfo = dict.plan_cancel_start(first);
    } else if (it.type === 'warranty' && it.warrantyMonths) {
      if (dict.warranty_end_month) rightInfo = dict.warranty_end_month(it.warrantyMonths);
    } else if (it.type === 'insurance') {
      const total = (Number(it.policyTermYears)||0)*12 + (Number(it.policyTermMonths)||0);
      if (total > 0 && dict.insurance_expire_month) {
        rightInfo = dict.insurance_expire_month(total);
      }
    }

    const div = document.createElement('div');
    div.className = `item ${it.id===activeId ? 'active':''}`;
    div.dataset.id = it.id;
    div.setAttribute('draggable', 'true');
    // --- 安全修改：使用 escapeHtml 转义所有用户输入 ---
    div.innerHTML = `
      <div>
        <div class="title item-line-1">
          <span>${escapeHtml(it.name||'')}</span>
          ${typeLabel}
          <span class="meta item-number">#${escapeHtml(it.number||'-')}</span>
        </div>
        <div class="meta item-line-2">
          <span>${dict.label_start}: ${escapeHtml(it.startDate || '-')}</span>
          ${rightInfo ? `<span style="margin-left:8px;">${rightInfo}</span>` : ''}
        </div>
        <div class="meta item-line-3">
          ${it.category ? `<span>· ${escapeHtml(it.category)}</span>` : ''}
          ${(it.tags?.length? `<span style="margin-left:8px;">· ${it.tags.map(escapeHtml).join('/')}</span>`:'')}
        </div>
      </div>
    `;
    // 点击只负责“选中”，编辑在顶部“编辑项目”按钮触发
    div.addEventListener('click', ()=>{
      activeId = it.id;
      render();
    });
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
    head.innerHTML='';
    grid.innerHTML=`<div class=small>${dict.left_hint}</div>`; return;
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
    if (it.type !== 'insurance' && it.cancelWindows?.length){
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
      if (idx>=1 && idx<=wm) badge = `<span class="badge">${dict.in_warranty}</span>`;
      else if (idx>wm && wm>0) badge = `<span class="badge cancel">${dict.out_warranty}</span>`;
      cells.push(`<div class="cell ${isTodayMonth?'today-month':''}" data-idx="${idx}" style="text-align:center;">${contentDivStart}${badge}${contentDivEnd}</div>`);
    } else {
      const { amount, remainAfter } = applyBalanceForMonth(it, sortedPricePhases, m0, idx);
      const cancel = (it.type !== 'insurance') && isInCancel(it.cancelWindows, idx);
      let segClass = '';
      if (amount!=null){
        let seg=0;
        for(let j=0;j<sortedPricePhases.length;j++){ if(idx>=sortedPricePhases[j].fromMonth) seg=j; }
        segClass = (seg%2===0)?'amount-segment-1':'amount-segment-2';
      }
      const amountHtml = (amount!=null && isFiscalMonth)
        ? `<div class="badge ${segClass} editable-amount" title="点击修改">${fmtMoney(amount, it.currency||'CNY')}</div>`
        : (isFiscalMonth ? `<div class="badge editable-amount" style="opacity:.6" title="点击新增或修改">—</div>` : '');
      const balanceHtml = (Number(it.balance||0)>0 && isFiscalMonth)
        ? `<div class="small" style="margin-top:2px;color:#667085">${dict.balance_prefix}${fmtMoney(Math.max(0, remainAfter), it.currency||'CNY')}</div>`
        : '';
      const cancelHtml = cancel? `<div class="badge cancel">${dict.cancel_period}</div>` : '';
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
        const input = prompt(I18N[LANG].prompt_amount(idx, curAmount), curAmount!=null? String(curAmount) : '');
        if (input==null) return;
 
        let newAmount = Number(input);
        if (Number.isNaN(newAmount) || newAmount<0){ alert(I18N[LANG].err_amount); return; }

        // 第二个输入：余额（可选）
        const hasExistingBal = Number(curItem.balance||0)>0 && idx >= Number(curItem.balanceFrom||Infinity);
        const balInput = prompt(I18N[LANG].prompt_balance(hasExistingBal), hasExistingBal ? String(curItem.balance) : '');
        let balancePatch = {};
        if (balInput !== null) {
          const trimmed = balInput.trim();
          if (trimmed==='') {
            // 不改
          } else {
            const bal = Math.max(0, Number(trimmed));
            if (Number.isNaN(bal)) { alert(I18N[LANG].err_amount); return; }
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
  $('#dlgTitle').textContent=I18N[LANG].dialog_edit.replace('编辑','新增');
  $('#btnDeleteInDialog').style.display='none';
  $('#dlg').style.display='flex';
};
// 顶部“编辑项目”按钮：针对当前选中的 activeId
$('#btnEdit').onclick = ()=>{
  if (!activeId) return;
  const dict = I18N[LANG] || I18N.zh;
  const it = allCloudItems.find(x=>x.id===activeId);
  if (!it) return;
  editingId = it.id;
  fillForm(it);
  showDialogMsg('', true);
  $('#dlgTitle').textContent = dict.dialog_edit;
  $('#btnDeleteInDialog').style.display = 'inline-block';
  $('#dlg').style.display = 'flex';
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

$('#btnClearSearch').onclick = ()=>{
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
    const a = document.createElement('a'); a.href=url;
    a.download = `expense-timeline-export-${Date.now()}.json`;
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
        const amountInfo = applyBalanceForMonth(it, sorted, m0, idx);
        const rawAmount = amountInfo.amount;
        if (idx >= 1 && rawAmount!=null && !(it.type !== 'insurance' && isInCancel(it.cancelWindows, idx))) {
          val = rawAmount;
        }
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
    return `<div class="card"><b>${I18N[LANG].stats_title}（${cur}）</b><table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr><th style="text-align:left">月份</th><th style="text-align:right">合计</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  const sectionCats = [...byCategory.entries()].map(([cur, map])=>{
    // --- 安全修改：escapeHtml(k) ---
    const rows = [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=> `<tr><td>${escapeHtml(k)}</td><td style="text-align:right">${fmtMoney(v, cur)}</td></tr>`).join('');
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
  let data;
  try{ data = JSON.parse(text||'{}'); }catch{ data = { error:text||'网络错误' }; }

  if(!r.ok){
    const isAuthPath = ['/api/login','/api/register','/api/register-send-code','/api/password-reset-send-code','/api/password-reset-confirm','/api/csrf'].includes(path);
    if ((r.status===400) && isAuthPath) throw new Error(data.error || '操作失败，请检查输入');
    if (r.status===429) throw new Error(data.error || '请求过于频繁，请稍后再试');
    if (r.status===403){ throw new Error(data.error || '安全验证失败，请刷新页面'); }
    if (r.status===401 && !isAuthPath){
      ONLINE=false;
      $('#btnUser').textContent=I18N[LANG].login_register; $('#btnLogout').style.display='none';
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
$('#btnUser').onclick = ()=>{
  $('#login_em').value=''; $('#login_pw').value='';
  $('#reg_em').value='';
  $('#reg_pw').value=''; $('#reg_code').value='';
  $('#reset_em').value=''; $('#reset_code').value=''; $('#reset_pw').value='';
  DlgAuth.show('login');
};
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
    try{ await fetch('/api/csrf', { method:'GET', credentials:'include' });
    } catch {}
  }
}
async function loadCloudItems(){
  showLoader();
  try{
    allCloudItems = await api('/api/items');
    allCloudItems.sort((a,b)=>(a.order||0)-(b.order||0));
    if(allCloudItems.length>0 && !allCloudItems.find(it=>it.id===activeId)) activeId = allCloudItems[0].id;
    render();
  } catch(e){ console.error(I18N[LANG].err_load, e.message); }
  finally{ hideLoader(); }
}
async function checkLogin(){
  showLoader();
  try{
    const me = await api('/api/me');
    ONLINE=true; $('#btnUser').textContent = me.email; $('#btnLogout').style.display='inline-block';
    // --- 修复：强制清空搜索框，避免浏览器自动填充导致过滤出空列表 ---
    $('#filter').value = '';
    await loadCloudItems();
  } catch(e){
    ONLINE=false; $('#btnUser').textContent=I18N[LANG].login_register; DlgAuth.show('login'); hideLoader();
  }
}

async function bootstrap(){
  applyI18n();
  // 初始化界面文案
  const btn = $('#btnLang');   // 设置按钮简称
  if (btn) btn.textContent = LANG_SHORT[LANG] || '中';
  await ensureCsrf();
  checkLogin();
}
bootstrap();

// ====== 登录/注册/重置交互 ======
$('#btnSendRegCode').onclick = async ()=>{
  const btn = $('#btnSendRegCode');
  const email = $('#reg_em').value.trim();
  if(!email) return DlgAuth.showMsg('register', I18N[LANG].email);
  btn.disabled=true; DlgAuth.showMsg('register','发送中...', true);
  try{
    const d = await api('/api/register-send-code', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email }) });
    DlgAuth.showMsg('register', d.message || '验证码已发送', true);
    DlgAuth.startCountdown(btn);
  }catch(e){ DlgAuth.showMsg('register', e.message || '发送失败'); btn.disabled=false; }
};
$('#goReg').onclick = async ()=>{
  const b=$('#goReg');
  b.disabled=true; DlgAuth.showMsg('register','');
  try{
    const email=$('#reg_em').value.trim(), password=$('#reg_pw').value, code=$('#reg_code').value.trim();
    await api('/api/register', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email, password, code }) });
    DlgAuth.showMsg('register','注册成功，请返回登录', true);
  }catch(e){ DlgAuth.showMsg('register', e.message || '注册失败');
  }
  finally{ b.disabled=false; }
};
$('#goLogin').onclick = async ()=>{
  const b=$('#goLogin'); b.disabled=true; DlgAuth.showMsg('login',''); showLoader();
  try{
    await api('/api/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:$('#login_em').value.trim(), password:$('#login_pw').value }) });
    const me = await api('/api/me');
    ONLINE=true;
    $('#btnUser').textContent = me.email; $('#btnLogout').style.display='inline-block'; DlgAuth.hide(); await loadCloudItems();
  }catch(e){ DlgAuth.showMsg('login', e.message || '登录失败'); hideLoader(); }
  finally{ b.disabled=false; }
};
$('#btnSendResetCode').onclick = async ()=>{
  const btn=$('#btnSendResetCode'); const email=$('#reset_em').value.trim();
  if(!email) return DlgAuth.showMsg('reset', I18N[LANG].reg_email);
  btn.disabled=true; DlgAuth.showMsg('reset','发送中...', true);
  try{
    const d = await api('/api/password-reset-send-code', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email }) });
    DlgAuth.showMsg('reset', d.message || '验证码已发送', true);
    DlgAuth.startCountdown(btn);
  }catch(e){ DlgAuth.showMsg('reset', e.message || '发送失败'); btn.disabled=false; }
};
$('#goReset').onclick = async ()=>{
  const b=$('#goReset');
  b.disabled=true; DlgAuth.showMsg('reset','');
  try{
    const email=$('#reset_em').value.trim(), code=$('#reset_code').value.trim(), newPassword=$('#reset_pw').value;
    await api('/api/password-reset-confirm', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, code, newPassword }) });
    DlgAuth.showMsg('reset','密码重置成功，请返回登录', true);
  }catch(e){ DlgAuth.showMsg('reset', e.message || '重置失败');
  }
  finally{ b.disabled=false; }
};