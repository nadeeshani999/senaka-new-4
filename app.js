'use strict';
/* ═══════════════════════════════════════════════
   SENAKA GROUP DASHBOARD — app.js v6.3
   Real-time Operations & Finance Intelligence
   Change: Finance page — removed Portfolio Breakdown (donut) &
           Repayment Progress (stacked) charts; Outstanding by
           Lender is now full-width with Bank Name dropdown filter;
           Monthly Obligations changed to bar chart.
═══════════════════════════════════════════════ */

/* ─── CONFIG ─── */
const SHEET_ID = '17XLTUh4GQ3uy11k26tovC3lgipijrwCMfxb_G7rPvTk';
const TABS = {
  bank:'BankPosition', cash:'CashInHand',
  invoices:'InvoiceReceivables', finance:'FinanceLiability',
  tenderCompleted:'Completed Tender Status', tenderOngoing:'On-going Tender Status',
  sleepersOngoing:'Sleepers Production-Ongoing', sleepersCompleted:'Sleepers Production - Completed',
  vehicle:'VehicleFleet', filling:'FillingStation', freshness:'DataFreshness'
};
const PAGES = ['bank','cash','invoices','finance','tender','sleepers','vehicle','filling'];
const PAGE_TITLES = {
  bank:'🏦 Bank Position', cash:'💵 Cash in Hand', invoices:'📋 Invoice Receivables',
  finance:'🏛️ Finance Liability', tender:'🏗️ PS Pole Production',
  sleepers:'🛤️ Sleepers Production',
  vehicle:'🚛 Vehicle Fleet', filling:'⛽ Filling Station'
};
const FRESHNESS_MAP = {
  'bank position':'bank','cash in hand':'cash','invoice receivables':'invoices',
  'finance liability':'finance','tender production':'tender',
  'sleepers production':'sleepers',
  'vehicle fleet':'vehicle','filling station':'filling'
};

/* ─── USERS & ACCESS CONTROL ─── */
const USERS = [
  { name:'Chairman',  pass:'Aa', pages:'all',                              display:'Chairman'        },
  { name:'BOD',       pass:'Bb', pages:'all',                              display:'BOD'             },
  { name:'Sanjeewa',  pass:'Cc', pages:'all',                              display:'Sanjeewa'        },
  { name:'Admin',     pass:'Dd', pages:'all',                              display:'Admin / Developer'},
  { name:'Sanduni',   pass:'Ee', pages:['bank'],                           display:'Sanduni'         },
  { name:'Piyumi',    pass:'Ff', pages:['invoices','tender','sleepers'],    display:'Piyumi'          },
  { name:'Thilini',   pass:'Gg', pages:['invoices','vehicle'],              display:'Thilini'         },
  { name:'Prasad',    pass:'Hh', pages:['finance'],                         display:'Prasad'          },
  { name:'Thusitha',  pass:'Ii', pages:['sleepers'],                        display:'Thusitha'        },
  { name:'Chathura',  pass:'Jj', pages:['filling'],                         display:'Chathura'        },
  { name:'Udayanga',  pass:'Kk', pages:['vehicle'],                         display:'Udayanga'        },
  { name:'Shamini',   pass:'Ll', pages:['cash'],                            display:'Shamini'         },
  { name:'Dayani',    pass:'Mm', pages:['tender'],                          display:'Dayani'          },
  { name:'Wathsala',  pass:'Ww', pages:['cash','filling','tender','sleepers'], display:'Wathsala'     },
];

const Auth = {
  user: null,
  login(username, pass) {
    const u = USERS.find(u =>
      u.name.toLowerCase() === username.trim().toLowerCase() && u.pass === pass
    );
    if (!u) return false;
    this.user = { name:u.name, display:u.display, pages:u.pages };
    try { localStorage.setItem('sg_auth', JSON.stringify(this.user)); } catch(e) {}
    return true;
  },
  restore() {
    try {
      const saved = localStorage.getItem('sg_auth');
      if (saved) { this.user = JSON.parse(saved); return !!this.user?.name; }
    } catch(e) {}
    return false;
  },
  logout() {
    this.user = null;
    try { localStorage.removeItem('sg_auth'); } catch(e) {}
  },
  canAccess(page) {
    if (!this.user) return false;
    if (this.user.pages === 'all') return true;
    return Array.isArray(this.user.pages) && this.user.pages.includes(page);
  },
  allowedPages() {
    if (!this.user) return [];
    if (this.user.pages === 'all') return [...PAGES];
    return PAGES.filter(p => this.user.pages.includes(p));
  }
};

/* ─── THEME ─── */
const C = {
  bg:'#080c12', card:'#0d1117', primary:'#00c8ff', sec:'#0081a8',
  accent:'#00e5ff', text:'#cdd6f4', muted:'#7c8db0',
  green:'#10b981', amber:'#f59e0b', red:'#f43f5e', gray:'#4a5568', blue:'#60a5fa',
  grid:'rgba(0,200,255,0.05)', tick:'#4a5568',
  PALETTE:['#00c8ff','#10b981','#f59e0b','#60a5fa','#7c3aed',
           '#f43f5e','#14b8a6','#f97316','#a78bfa','#84cc16',
           '#ec4899','#22d3ee','#fb923c','#34d399']
};
const KPI_RGB = { green:'16,185,129', amber:'245,158,11', red:'244,63,94',
                  blue:'96,165,250', purple:'124,58,237', primary:'0,200,255' };

/* ─── STATE ─── */
const State = { currentPage:'bank', charts:{}, initialized:new Set(), freshnessData:[], tankLevels:{} };

/* ═══════════════════════════════════════════════
   ANIMATED BACKGROUND CANVAS
═══════════════════════════════════════════════ */
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, dots = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    dots = Array.from({length: 55}, () => ({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
      r:Math.random()*1.5+.5
    }));
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    for (let i=0; i<dots.length; i++) {
      const d = dots[i];
      d.x+=d.vx; d.y+=d.vy;
      if (d.x<0||d.x>W) d.vx*=-1;
      if (d.y<0||d.y>H) d.vy*=-1;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle='rgba(0,200,255,0.12)'; ctx.fill();
    }
    ctx.lineWidth=.5;
    for (let i=0; i<dots.length; i++) {
      for (let j=i+1; j<dots.length; j++) {
        const dx=dots[i].x-dots[j].x, dy=dots[i].y-dots[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<110) {
          ctx.globalAlpha=(1-dist/110)*.12;
          ctx.strokeStyle='rgba(0,200,255,0.20)';
          ctx.beginPath(); ctx.moveTo(dots[i].x,dots[i].y); ctx.lineTo(dots[j].x,dots[j].y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', resize);
  draw();
}

/* ═══════════════════════════════════════════════
   SOUND EFFECTS
═══════════════════════════════════════════════ */
const Sound = {
  ctx:null, enabled:true,
  init() { try { this.ctx=new(window.AudioContext||window.webkitAudioContext)(); } catch(e){ this.enabled=false; } },
  unlock() { if (this.ctx?.state==='suspended') this.ctx.resume(); },
  async _tone(freq, type, dur, vol, sweep) {
    if (!this.enabled||!this.ctx) return;
    try {
      if (this.ctx.state==='suspended') await this.ctx.resume();
      const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type=type||'sine';
      const t=this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq,t);
      if (sweep) osc.frequency.exponentialRampToValueAtTime(sweep,t+dur*.75);
      gain.gain.setValueAtTime(vol||.08,t);
      gain.gain.exponentialRampToValueAtTime(.001,t+dur);
      osc.start(t); osc.stop(t+dur);
    } catch(e){}
  },
  nav()     { this._tone(480,'sine',.13,.12,740); setTimeout(()=>this._tone(740,'sine',.13,.10),85); },
  click()   { this._tone(880,'square',.05,.06); },
  chart()   { this._tone(660,'sine',.09,.08); setTimeout(()=>this._tone(990,'sine',.07,.06),65); },
  success() {
    this._tone(523,'sine',.18,.12);
    setTimeout(()=>this._tone(659,'sine',.18,.12),120);
    setTimeout(()=>this._tone(784,'sine',.26,.12),240);
  },
  warn()    { this._tone(280,'triangle',.22,.10,210); },
  refresh() { this._tone(580,'sine',.22,.10,920); },
  load()    { this._tone(320,'sine',.16,.08,500); setTimeout(()=>this._tone(440,'sine',.12,.06,520),140); },
  liquid()  {
    this._tone(155,'sine',.35,.10,185);
    setTimeout(()=>this._tone(195,'sine',.25,.08,152),175);
    setTimeout(()=>this._tone(140,'sine',.2,.06,165),320);
  }
};

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */
function fmtLKR(n, compact) {
  if (n==null||isNaN(n)) return '—';
  const abs=Math.abs(n);
  if (compact) {
    if (abs>=1e7) return (n/1e7).toFixed(2)+'Cr';
    if (abs>=1e5) return (n/1e5).toFixed(2)+'L';
    if (abs>=1e3) return (n/1e3).toFixed(1)+'K';
  }
  return new Intl.NumberFormat('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
}
function fmtLKRFull(n) {
  if (n==null||isNaN(n)) return '—';
  return new Intl.NumberFormat('en-LK',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(n));
}
function fmtDate(d) {
  if (!d) return '—';
  if (d instanceof Date) return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  return String(d);
}
function daysAgo(d) {
  if (!d) return null;
  const date=d instanceof Date?d:new Date(d); if (isNaN(date)) return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const then=new Date(date); then.setHours(0,0,0,0);
  return Math.floor((today-then)/86400000);
}
function statusBadge(label, cls) { return `<span class="badge badge-${cls}">${label}</span>`; }
function progressBar(pct) {
  const p=Math.min(100,Math.max(0,pct||0));
  const col=p>=75?'var(--green)':p>=50?'var(--blue)':p>=25?'var(--amber)':'var(--red)';
  return `<div class="prog-bar-wrap"><div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${p}%;background:${col}"></div></div><span class="prog-pct">${p.toFixed(0)}%</span></div>`;
}
function freshnessAge(d) {
  const days=daysAgo(d);
  if (days==null) return {badge:'ft-unknown',label:'Unknown',pill:'gray'};
  if (days===0)   return {badge:'ft-fresh',  label:'Live',    pill:'green'};
  if (days===1)   return {badge:'ft-warn',   label:'1d old',  pill:'amber'};
  return          {badge:'ft-stale',   label:`${days}d old`, pill:'red'};
}

/* ─── COUNTUP ─── */
function countUp(el, target, dur=1100, prefix='', suffix='') {
  if (!el) return;
  const start=performance.now();
  function tick(now) {
    const t=Math.min(1,(now-start)/dur);
    const ease=1-Math.pow(1-t,3);
    el.textContent=prefix+(target*ease>=1000?fmtLKR(target*ease):Math.round(target*ease).toLocaleString())+suffix;
    if (t<1) requestAnimationFrame(tick);
    else el.textContent=prefix+(target>=1000?fmtLKR(target):target.toLocaleString())+suffix;
  }
  requestAnimationFrame(tick);
}

/* ─── KPI RENDER ─── */
function renderKPIs(containerId, cards) {
  const el=document.getElementById(containerId); if (!el) return;
  const uid=containerId;
  el.innerHTML=cards.map((c,i)=>{
    const col=c.color||'primary';
    const rgb=KPI_RGB[col]||'0,200,255';
    const canvasId=`spark-${uid}-${i}`;

    // Extract numeric value — strip currency symbols, commas, letters
    let numVal = c.rawVal;
    if(!numVal || numVal===0) {
      const cleaned = String(c.value).replace(/[^0-9.\-]/g,'');
      numVal = parseFloat(cleaned) || 1;
    }

    // delta badge
    let deltaHtml='';
    if(c.delta){
      const isNeg=String(c.delta).includes('-');
      const dClass=isNeg?'kpi-delta-neg':'kpi-delta-pos';
      const arrow=isNeg?'↓':'↑';
      deltaHtml=`<div class="kpi-delta ${dClass}">${arrow} ${c.delta}</div>`;
    }
    return `<div class="kpi-card" style="--kpi-rgb:${rgb};--stagger:${i}" data-canvas="${canvasId}" data-numval="${numVal}">
      <div class="kpi-top-row">
        <div class="kpi-top-left">
          <span class="kpi-icon">${c.icon||'📊'}</span>
          <span class="kpi-label">${c.label}</span>
        </div>
        ${deltaHtml}
      </div>
      <div class="kpi-value" data-raw="${c.rawVal||0}" data-pfx="${c.prefix||''}" data-sfx="${c.suffix||''}">${c.value}</div>
      <div class="kpi-spark-wrap">
        <canvas id="${canvasId}" class="kpi-spark-canvas"></canvas>
      </div>
    </div>`;
  }).join('');

  // setTimeout gives browser time to fully paint + measure card widths
  setTimeout(()=>{
    cards.forEach((c,i)=>{
      const canvasId=`spark-${uid}-${i}`;
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;
      const col=c.color||'primary';
      const rgb=KPI_RGB[col]||'0,200,255';

      // Get numeric value from card data attribute
      const card=canvas.closest('.kpi-card');
      const wrap=canvas.closest('.kpi-spark-wrap');
      if(card){
        const cardW=card.getBoundingClientRect().width;
        const wrapH=(wrap && wrap.offsetHeight>0) ? wrap.offsetHeight : 100;
        canvas.style.width=cardW+'px';
        canvas.style.height=wrapH+'px';
      }

      const numVal = parseFloat(card?.dataset.numval) || 100;
      const data=c.sparkData||generateFakeSparkData(numVal);
      canvas._sparkData=data;
      drawSparkline(canvas, data, rgb);
    });
  }, 150);
}

function generateFakeSparkData(finalVal) {
  const points = [];
  const base   = Math.abs(finalVal) || 100;
  // variance is 25% of value so the trend is always visible
  const variance = base * 0.25;
  let v = base * (0.55 + Math.random() * 0.2);
  for (let i = 0; i < 14; i++) {
    v += (base - v) * 0.25 + (Math.random() - 0.45) * variance;
    points.push(Math.max(base * 0.1, v));
  }
  points.push(base); // always end at actual value
  return points;
}

function drawSparkline(canvas, data, rgb) {
  const dpr = window.devicePixelRatio || 1;

  const card = canvas.closest('.kpi-card');
  const wrap = canvas.closest('.kpi-spark-wrap');
  const rect  = card ? card.getBoundingClientRect() : null;
  const w = (rect && rect.width > 0) ? rect.width : 220;
  const h = (wrap && wrap.offsetHeight > 0) ? wrap.offsetHeight : 100;

  // Set both the drawing buffer AND the CSS display size
  canvas.width        = Math.round(w * dpr);
  canvas.height       = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  if (!data || data.length < 2) return;

  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const padX  = 2;
  const padY  = 8;

  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (w - padX * 2),
    y: h - padY - ((v - min) / range) * (h - padY * 2)
  }));

  // Smooth bezier curve helper
  function drawSmooth(points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cx = (points[i].x + points[i+1].x) / 2;
      ctx.bezierCurveTo(cx, points[i].y, cx, points[i+1].y, points[i+1].x, points[i+1].y);
    }
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(${rgb}, 0.4)`);
  grad.addColorStop(1, `rgba(${rgb}, 0.0)`);

  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  ctx.lineTo(pts[0].x, pts[0].y);
  drawSmooth(pts);
  ctx.lineTo(pts[pts.length-1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  drawSmooth(pts);
  ctx.strokeStyle = `rgba(${rgb}, 1)`;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Glowing end dot
  const last = pts[pts.length-1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI*2);
  ctx.fillStyle   = `rgb(${rgb})`;
  ctx.shadowColor = `rgba(${rgb}, 0.9)`;
  ctx.shadowBlur  = 8;
  ctx.fill();
  ctx.shadowBlur  = 0;
}

/* ─── TOAST ─── */
function toast(msg, type='') {
  const wrap=document.getElementById('toast-wrap'); if (!wrap) return;
  const el=document.createElement('div');
  el.className=`toast toast-${type}`; el.textContent=msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.classList.add('hiding'); setTimeout(()=>el.remove(),350); },3200);
}

/* ─── NO-DATA STATE ─── */
function showNoData(sectionId, tabName, msg) {
  const pg=document.getElementById(sectionId); if (!pg) return;
  pg.querySelector('.no-data-state')?.remove();
  const el=document.createElement('div'); el.className='no-data-state';
  el.innerHTML=`<div class="no-data-icon">📭</div>
    <div class="no-data-title">${msg||'No data available'}</div>
    <div class="no-data-sub">Ensure the Google Sheet has a tab named <strong>"${tabName}"</strong>. Data appears automatically once updated.</div>
    <div class="no-data-sheet">Expected tab: ${tabName}</div>`;
  const ref=pg.querySelector('.kpi-row')||pg.querySelector('.charts-row')||pg.firstChild;
  pg.insertBefore(el,ref);
}

/* ─── TABLE HELPERS ─── */
function setTableCount(id, n) {
  const el=document.getElementById(id); if (el) el.textContent=`${n} record${n!==1?'s':''}`;
}
function filterRows(rows, q) {
  if (!q) return rows;
  const lq=q.toLowerCase();
  return rows.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(lq)));
}
function renderRowsInto(tbody, rows, renderer) {
  if (!tbody||!renderer) return;
  if (!rows?.length) { tbody.innerHTML=`<tr class="no-data"><td colspan="99">No records found</td></tr>`; return; }
  tbody.innerHTML=rows.map(renderer).join('');
  tbody.querySelectorAll('.expand-btn').forEach(btn=>{
    btn.addEventListener('click',function(){
      Sound.click();
      const next=this.closest('tr').nextElementSibling;
      if (next?.classList.contains('expand-row')) {
        this.classList.toggle('open');
        next.style.display=next.style.display==='none'?'':'none';
      }
    });
  });
}
function makeTableSortable(tableId, searchId, allRows) {
  const tbl=document.getElementById(tableId); if (!tbl) return;
  let sortCol=null, sortDir=1;
  function sorted(rows) {
    if (!sortCol) return rows;
    return [...rows].sort((a,b)=>{
      const av=a[sortCol],bv=b[sortCol];
      if (av==null) return 1; if (bv==null) return -1;
      if (av instanceof Date&&bv instanceof Date) return (av-bv)*sortDir;
      if (typeof av==='number'&&typeof bv==='number') return (av-bv)*sortDir;
      return String(av).localeCompare(String(bv))*sortDir;
    });
  }
  tbl.querySelectorAll('thead th[data-col]').forEach(th=>{
    th.addEventListener('click',()=>{
      Sound.click();
      const col=th.dataset.col;
      if (sortCol===col) sortDir*=-1; else { sortCol=col; sortDir=1; }
      tbl.querySelectorAll('thead th').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortDir===1?'sort-asc':'sort-desc');
      const q=document.getElementById(searchId)?.value||'';
      renderRowsInto(tbl.querySelector('tbody'),sorted(filterRows(allRows,q)),allRows._renderer);
    });
  });
  const se=document.getElementById(searchId);
  if (se) se.addEventListener('input',()=>{
    renderRowsInto(tbl.querySelector('tbody'),sorted(filterRows(allRows,se.value)),allRows._renderer);
  });
}

/* ═══════════════════════════════════════════════
   GOOGLE SHEETS FETCHER
═══════════════════════════════════════════════ */
const Sheets = {
  SIGS: {
    'BankPosition':['bank name','account number'],'CashInHand':['cash float name'],
    'InvoiceReceivables':['invoice number','invoice amount'],'FinanceLiability':['loan account','capital outstanding'],
    'Completed Tender Status':['tender no','production start'],'On-going Tender Status':['total qty casted','balance to cast'],
    'Sleepers Production-Ongoing':['site name','total qty casted'],'Sleepers Production - Completed':['site name','tender no'],
    'VehicleFleet':['vehicle number','total distance'],'FillingStation':['petrol sales','diesel sales'],
    'DataFreshness':['page name','data owner']
  },
  async fetch(tabName) {
    const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&_t=${Date.now()}`;
    try {
      const res=await fetch(url); const text=await res.text();
      const match=text.match(/setResponse\(([\s\S]+?)\);\s*$/);
      if (!match) return null;
      const data=JSON.parse(match[1]);
      if (data.status!=='ok') return null;
      const parsed=this._parse(data.table,tabName);
      if (!this._verify(parsed,tabName)) { console.warn(`Tab mismatch: "${tabName}"`); return null; }
      return parsed;
    } catch(e){ console.warn(`Sheet error "${tabName}":`,e.message); return null; }
  },
  _parse(table,tabName) {
    if (!table?.cols||!table?.rows) return {cols:[],rows:[],tab:tabName};
    const cols=table.cols.map(c=>c.label||c.id||'');
    const rows=table.rows.filter(r=>r?.c).map(row=>{
      const obj={};
      row.c.forEach((cell,i)=>{
        const k=cols[i]; if (!k) return;
        if (!cell||cell.v==null) { obj[k]=null; return; }
        if (typeof cell.v==='string'&&cell.v.startsWith('Date(')) {
          const m=cell.v.match(/Date\((\d+),(\d+),(\d+)\)/);
          obj[k]=m?new Date(+m[1],+m[2],+m[3]):null;
        } else { obj[k]=cell.v; }
        if (cell.f) obj[`$${k}`]=cell.f;
      });
      return obj;
    }).filter(r=>r&&Object.values(r).some(v=>v!==null&&v!==''));
    return {cols,rows,tab:tabName};
  },
  _verify(data,tabName) {
    const sigs=this.SIGS[tabName]; if (!sigs) return true;
    if (!data?.cols.length) return false;
    const cl=data.cols.map(c=>c.toLowerCase());
    return sigs.some(s=>cl.some(c=>c.includes(s)));
  }
};

/* ═══════════════════════════════════════════════
   CHART FACTORY
═══════════════════════════════════════════════ */
const Charts = {
  _base() {
    return {
      responsive:true, maintainAspectRatio:false,
      animation:{ duration:950, easing:'easeInOutQuart' },
      plugins:{
        legend:{ labels:{ color:C.text, font:{family:"'Inter',system-ui,sans-serif",size:10}, padding:14, usePointStyle:true, pointStyleWidth:8 }},
        tooltip:{
          backgroundColor:'rgba(6,16,30,0.97)', borderColor:'rgba(124,58,237,0.40)', borderWidth:1,
          titleColor:C.accent, bodyColor:C.text,
          titleFont:{family:"'Inter',system-ui,sans-serif",size:11},
          bodyFont:{family:"'Inter',system-ui,sans-serif",size:11},
          padding:12, cornerRadius:9
        }
      }
    };
  },
  destroy(id) { if (State.charts[id]) { State.charts[id].destroy(); delete State.charts[id]; } },

  bar(id, labels, datasets, opts={}) {
    this.destroy(id);
    const canvas=document.getElementById(id); if (!canvas) return;
    const cfg=this._base();
    const axisStyle={ grid:{color:C.grid}, ticks:{color:C.tick,font:{family:"'Inter',system-ui,sans-serif",size:9}}, border:{display:false}};
    cfg.scales={ x:{...axisStyle}, y:{...axisStyle} };
    if (opts.horizontal) {
      cfg.indexAxis='y';
      cfg.scales.x.ticks.callback=v=>opts.currency?fmtLKR(v,true):v.toLocaleString();
      cfg.plugins.tooltip.callbacks={ label:ctx=>opts.currency?` Rs. ${fmtLKR(ctx.parsed.x)}`:`${ctx.parsed.x.toLocaleString()}${opts.unit||''}` };
    } else {
      cfg.scales.y.ticks.callback=v=>opts.currency?fmtLKR(v,true):v.toLocaleString();
      cfg.plugins.tooltip.callbacks={ label:ctx=>opts.currency?` Rs. ${fmtLKR(ctx.parsed.y)}`:`${ctx.parsed.y.toLocaleString()}${opts.unit||''}` };
    }
    if (opts.stacked) { cfg.scales.x.stacked=true; cfg.scales.y.stacked=true; }
    if (opts.extra) Object.assign(cfg,opts.extra);
    const canvasCtx=canvas.getContext('2d');
    const gH=(canvas.parentElement?.offsetHeight||280)-28;
    const gW=(canvas.parentElement?.offsetWidth||400)-28;
    const mkGrad=(hex)=>{
      const h=hex.slice(0,7);
      const g=opts.horizontal
        ?canvasCtx.createLinearGradient(gW,0,0,0)
        :canvasCtx.createLinearGradient(0,0,0,gH);
      g.addColorStop(0,h+'f2');
      g.addColorStop(0.5,h+'88');
      g.addColorStop(1,h+'18');
      return g;
    };
    const mkBg=(d,i)=>{
      if(d.colors) return d.colors.map(c=>mkGrad(c));
      if(Array.isArray(d.data)) return d.data.map((_,j)=>mkGrad(C.PALETTE[j%C.PALETTE.length]));
      return mkGrad(C.PALETTE[i%C.PALETTE.length]);
    };
    const mkBorder=(d,i)=>{
      if(d.colors) return d.colors.map(c=>c.slice(0,7)+'cc');
      if(Array.isArray(d.data)) return d.data.map((_,j)=>C.PALETTE[j%C.PALETTE.length]);
      return C.PALETTE[i%C.PALETTE.length];
    };
    State.charts[id]=new Chart(canvas,{
      type:'bar',
      data:{ labels, datasets:datasets.map((d,i)=>({
        backgroundColor:mkBg(d,i),
        borderColor:mkBorder(d,i),
        borderWidth:opts.stacked?0:1.5,
        borderRadius:opts.stacked?0:8, borderSkipped:false, ...d
      }))},
      options:cfg
    });
    canvas.addEventListener('click',()=>{ Sound.unlock(); Sound.chart(); },{passive:true});
    return State.charts[id];
  },

  donut(id, labels, data, opts={}) {
    this.destroy(id);
    const canvas=document.getElementById(id); if (!canvas) return;
    const cfg=this._base();
    cfg.cutout=opts.cutout||'62%';
    cfg.plugins.legend.position='bottom';
    if (opts.rotation) cfg.rotation=opts.rotation;
    if (opts.circumference) cfg.circumference=opts.circumference;
    cfg.plugins.tooltip.callbacks={
      label:ctx=>opts.currency?` ${ctx.label}: Rs. ${fmtLKR(ctx.parsed)}`:`${ctx.label}: ${ctx.parsed.toLocaleString()}${opts.unit||''}`
    };
    const plugins=[];
    if (opts.centerText) {
      plugins.push({
        id:'center',
        afterDraw(chart){
          const {ctx,chartArea:{left,right,top,bottom}}=chart;
          const cx=(left+right)/2, cy=opts.circumference?top+(bottom-top)*.82:(top+bottom)/2;
          ctx.save();
          ctx.font=`700 1.2rem Georgia,'Times New Roman',serif`;
          ctx.fillStyle=opts.centerColor||C.text;
          ctx.textAlign='center';
          ctx.fillText(opts.centerText,cx,cy);
          if (opts.centerSub){
            ctx.font=`0.62rem Georgia,'Times New Roman',serif`;
            ctx.fillStyle=C.muted;
            ctx.fillText(opts.centerSub,cx,cy+18);
          }
          ctx.restore();
        }
      });
    }
    const dPal=C.PALETTE.slice(0,data.length);
    State.charts[id]=new Chart(canvas,{
      type:'doughnut',
      data:{ labels, datasets:[{
        data,
        backgroundColor:dPal.map(c=>c+'bf'),
        borderColor:dPal,
        borderWidth:2.5,
        hoverBackgroundColor:dPal,
        hoverBorderColor:dPal.map(c=>c+'55'),
        hoverBorderWidth:3,
        hoverOffset:14
      }]},
      options:cfg, plugins
    });
    canvas.addEventListener('click',()=>{ Sound.unlock(); Sound.chart(); },{passive:true});
    return State.charts[id];
  },

  polar(id, labels, data, opts={}) {
    this.destroy(id);
    const canvas=document.getElementById(id); if (!canvas) return;
    const cfg=this._base();
    cfg.plugins.legend.position='right';
    cfg.scales={ r:{ grid:{color:C.grid}, ticks:{color:C.tick,font:{family:"'Inter',system-ui,sans-serif",size:9},backdropColor:'transparent'}, pointLabels:{color:C.muted,font:{family:"'Inter',system-ui,sans-serif",size:10}}}};
    cfg.plugins.tooltip.callbacks={ label:ctx=>` ${ctx.label}: ${ctx.parsed.r.toLocaleString()}${opts.unit||''}` };
    State.charts[id]=new Chart(canvas,{
      type:'polarArea',
      data:{ labels, datasets:[{ data, backgroundColor:C.PALETTE.slice(0,data.length).map(c=>c+'99'), borderColor:C.PALETTE.slice(0,data.length), borderWidth:1.5 }]},
      options:cfg
    });
    canvas.addEventListener('click',()=>{ Sound.unlock(); Sound.chart(); },{passive:true});
    return State.charts[id];
  },

  scatter(id, datasets, opts={}) {
    this.destroy(id);
    const canvas=document.getElementById(id); if (!canvas) return;
    const cfg=this._base();
    const axisStyle={ grid:{color:C.grid}, ticks:{color:C.tick,font:{family:"'Inter',system-ui,sans-serif",size:9}}, border:{display:false}};
    cfg.scales={
      x:{...axisStyle, title:{display:true,text:opts.xLabel||'X',color:C.muted,font:{family:"'Inter',system-ui,sans-serif",size:9}}},
      y:{...axisStyle, title:{display:true,text:opts.yLabel||'Y',color:C.muted,font:{family:"'Inter',system-ui,sans-serif",size:9}}}
    };
    cfg.plugins.tooltip.callbacks={ label:ctx=>`${ctx.raw.label||''} (${ctx.raw.x.toFixed(1)}, ${ctx.raw.y.toFixed(1)})` };
    cfg.plugins.legend.display=false;
    State.charts[id]=new Chart(canvas,{
      type:'scatter',
      data:{ datasets:datasets.map((d,i)=>({ borderColor:C.PALETTE[i%C.PALETTE.length], backgroundColor:C.PALETTE[i%C.PALETTE.length]+'88', pointRadius:6, pointHoverRadius:9, ...d }))},
      options:cfg
    });
    canvas.addEventListener('click',()=>{ Sound.unlock(); Sound.chart(); },{passive:true});
    return State.charts[id];
  },

  /* ─── BANK DOT PLOT ─── */
  bankDotPlot(id, rows) {
    this.destroy(id);
    const canvas = document.getElementById(id); if (!canvas) return;

    const sorted = [...rows].sort((a, b) => (a['Amount'] || 0) - (b['Amount'] || 0));
    const n = sorted.length;

    const box = canvas.parentElement;
    if (box) box.style.height = Math.min(Math.max(n * 28 + 70, 200), 400) + 'px';

    const cfg = this._base();
    cfg.animation = { duration: 800, easing: 'easeOutQuart' };
    cfg.layout    = { padding: { left: 4, right: 24, top: 8, bottom: 8 } };

    const axisStyle = {
      grid:   { color: C.grid },
      ticks:  { color: C.tick, font: { family: "'Inter',system-ui,sans-serif", size: 9 } },
      border: { display: false }
    };

    cfg.scales = {
      x: {
        ...axisStyle,
        type: 'linear',
        title: {
          display: true, text: 'Balance (LKR)',
          color: C.muted,
          font: { family: "'Inter',system-ui,sans-serif", size: 9 }
        },
        ticks: {
          ...axisStyle.ticks,
          maxTicksLimit: 6,
          callback: v => fmtLKR(v, true)
        }
      },
      y: {
        ...axisStyle,
        type: 'linear',
        min: -1,
        max: n,
        ticks: {
          color: C.tick,
          font: { family: "'Inter',system-ui,sans-serif", size: 9 },
          stepSize: 1,
          callback: v => {
            if (Number.isInteger(v) && v >= 0 && v < n) {
              const r = sorted[v];
              const abbr = (r['Bank Name'] || '')
                .replace('Peoples Bank ', 'PB ')
                .replace('Commercial - ', 'Comm. ')
                .replace('Sampath Bank-', 'Sampath ')
                .replace('Seylan – ', 'Seylan ')
                .replace('Seylan - ', 'Seylan ');
              const acc = String(r['Account Number'] || '').slice(-4);
              return acc ? abbr + ' ···' + acc : abbr;
            }
            return '';
          }
        }
      }
    };

    cfg.plugins.legend.display = false;

    cfg.plugins.tooltip.callbacks = {
      title: ctx => {
        try {
          const idx = Math.round(ctx[0].parsed.y);
          const r = sorted[idx];
          if (!r) return '—';
          return (r['Bank Name'] || '—') + '  ·  ' + (r['Account Number'] || '—');
        } catch(e) { return '—'; }
      },
      label: ctx => {
        try {
          if (!ctx || ctx.parsed == null) return '';
          const idx = Math.round(ctx.parsed.y);
          const r = sorted[idx];
          if (!r) return '';
          const lines = [];
          if (r['Account Type']) lines.push('Type: ' + r['Account Type']);
          lines.push('Balance: Rs. ' + fmtLKR(ctx.parsed.x));
          if (r['Last Updated']) lines.push('Updated: ' + fmtDate(r['Last Updated']));
          return lines;
        } catch(e) { return ''; }
      },
      labelColor: ctx => {
        try {
          if (!ctx || ctx.parsed == null) return { borderColor: '#00c8ff', backgroundColor: '#00c8ff' };
          const idx = Math.round(ctx.parsed.y);
          const r = sorted[idx];
          const col = r && (r['Amount'] || 0) < 0 ? '#f43f5e' : '#00c8ff';
          return { borderColor: col, backgroundColor: col };
        } catch(e) {
          return { borderColor: '#00c8ff', backgroundColor: '#00c8ff' };
        }
      }
    };

    /* cyan dot for positive, red for negative, white border so dots are always visible */
    const bgs     = sorted.map(r => (r['Amount'] || 0) < 0 ? 'rgba(244,63,94,0.90)'  : 'rgba(0,200,255,0.90)');
    const borders = sorted.map(() => '#ffffff');

    State.charts[id] = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          data:             sorted.map((r, i) => ({ x: r['Amount'] || 0, y: i })),
          backgroundColor:  bgs,
          borderColor:      borders,
          borderWidth:      2,
          pointRadius:      8,
          pointHoverRadius: 11,
          pointStyle:       'circle'
        }]
      },
      options: cfg
    });

    canvas.addEventListener('click', () => { Sound.unlock(); Sound.chart(); }, { passive: true });
    return State.charts[id];
  },

  zoom(id) {
    const canvas = document.getElementById(id);
    const chart  = State.charts[id];
    if (!canvas || !chart) { toast('Chart not loaded yet — please wait for the page to finish loading.','warn'); return; }
    const mo = document.getElementById('modal-overlay');
    const mc = document.getElementById('modal-content');
    if (!mo || !mc) return;

    const origParent = canvas.parentElement;
    const origHeight = origParent.style.height;

    mc.innerHTML = `<div id="zoom-modal-wrap">
      <div style="height:clamp(300px,60vh,520px);position:relative" id="zoom-chart-canvas-wrap"></div>
      <div style="font-size:.64rem;color:var(--muted);text-align:center;margin-top:10px;letter-spacing:.5px">Pinch or scroll to explore · Tap outside to close</div>
    </div>`;

    const wrap = document.getElementById('zoom-chart-canvas-wrap');
    wrap.appendChild(canvas);
    requestAnimationFrame(() => { chart.resize(); });
    mo.classList.remove('hidden');
    Sound.chart();

    function restore() {
      origParent.style.height = origHeight;
      origParent.appendChild(canvas);
      requestAnimationFrame(() => { chart.resize(); });
      mo.classList.add('hidden');
      mo.removeEventListener('click', onOverlay);
      document.getElementById('modal-close').onclick = null;
    }
    function onOverlay(e) { if (e.target === mo) restore(); }
    document.getElementById('modal-close').onclick = restore;
    mo.addEventListener('click', onOverlay);
  }
};

/* ═══════════════════════════════════════════════
   DATA FRESHNESS
═══════════════════════════════════════════════ */
async function loadFreshnessData() {
  const d=await Sheets.fetch(TABS.freshness);
  if (!d?.rows.length) return;
  State.freshnessData=d.rows;
  renderFreshnessPanel();
  applyFreshnessBadges();
}
function renderFreshnessPanel() {
  const panel=document.getElementById('freshness-panel'); if (!panel) return;
  panel.innerHTML=State.freshnessData.map(r=>{
    const status=String(r['Status']||'').toLowerCase();
    const dot=status.includes('up to date')||status.includes('current')?'dot-green':status.includes('1 day')?'dot-amber':status.includes('stale')?'dot-red':'dot-gray';
    const owner=r['Data Owner']||'';
    const upd=fmtDate(r['Last Updated']);
    return `<div class="fresh-item" title="Owner: ${owner}${upd?' · Updated: '+upd:''}">
      <span class="fi-dot ${dot}"></span>
      <span class="fi-name">${r['Page Name']||'—'}</span>
    </div>`;
  }).join('');
}
function applyFreshnessBadges() {
  State.freshnessData.forEach(r=>{
    const pageId=FRESHNESS_MAP[String(r['Page Name']||'').toLowerCase()];
    if (!pageId) return;
    const status=String(r['Status']||'').toLowerCase();
    const isStale=status.includes('stale');
    const is1d=status.includes('1 day');
    const ft=document.getElementById(`fresh-${pageId}`);
    if (ft){ ft.textContent=r['Status']; ft.className=`freshness-tag ${isStale?(is1d?'ft-warn':'ft-stale'):'ft-fresh'}`; }
    const stale=document.getElementById(`stale-${pageId}`);
    if (stale) stale.classList.toggle('hidden',!(isStale&&!is1d));
    const nb=document.getElementById(`nb-${pageId}`);
    if (nb){
      const match=status.match(/(\d+)\s*day/);
      if (match){ nb.textContent=match[1]+'d'; nb.className=`nav-badge ${+match[1]>=2?'badge-stale':'badge-warn'}`; }
      else nb.className='nav-badge';
    }
  });
}

/* ═══════════════════════════════════════════════
   PAGE 1 — BANK POSITION
═══════════════════════════════════════════════ */
async function initBankPage() {
  Sound.load();
  const d = await Sheets.fetch(TABS.bank);
  if (!d?.rows.length) { showNoData('pg-bank', TABS.bank, 'No bank data'); return; }
  const allRows = d.rows;

  const colB = d.cols[5];
  const companies = colB
    ? [...new Set(allRows.map(r => r[colB]).filter(Boolean))].sort()
    : [];
  const compSel = document.getElementById('bank-company-sel');
  if (compSel) {
    compSel.innerHTML = '<option value="">All Companies</option>' +
      companies.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function getFiltered() {
    let rows = allRows;
    const comp = compSel?.value;
    if (comp) rows = rows.filter(r => r[colB] === comp);
    return rows;
  }

  const abbrevBank = n => (n || 'Other')
    .replace('Peoples Bank ', 'PB ')
    .replace('Commercial - ', 'Comm. ')
    .replace('Sampath Bank-', 'Sampath ')
    .replace('Seylan - ', 'Seylan ')
    .replace('Seylan – ', 'Seylan ');

  const groupKey = n => abbrevBank(n).split(/[\s\-–]+/)[0].replace(/[^A-Za-z.]/g, '');

  function renderView(rows) {
    const deposits = rows.filter(r => (r['Amount'] || 0) > 0).reduce((s, r) => s + (r['Amount'] || 0), 0);
    const liabs    = Math.abs(rows.filter(r => (r['Amount'] || 0) < 0).reduce((s, r) => s + (r['Amount'] || 0), 0));
    const net      = deposits - liabs;
    const netPct   = deposits ? (net / deposits * 100) : 0;

    renderKPIs('bank-kpis', [
      { icon: '📈', label: 'Total Favorable Bank Balances',   value: 'Rs. ' + fmtLKRFull(deposits), color: 'green'               },
      { icon: '📉', label: 'Total Unfavorable Bank Balances', value: 'Rs. ' + fmtLKRFull(liabs),    color: 'red'                 },
      { icon: '⚖️', label: 'Net Bank Position',               value: 'Rs. ' + fmtLKRFull(net),      color: net >= 0 ? 'green' : 'red' },
      { icon: '🏦', label: 'Number of Bank Accounts',         value: rows.length,                   color: 'blue'                }
    ]);
    setTableCount('bank-count', rows.length);

    Charts.bankDotPlot('bank-bar', rows);

    const donutGroups = {};
    rows.filter(r => (r['Amount'] || 0) > 0).forEach(r => {
      const k = groupKey(r['Bank Name'] || 'Other');
      donutGroups[k] = (donutGroups[k] || 0) + r['Amount'];
    });
    Charts.donut('bank-donut', Object.keys(donutGroups), Object.values(donutGroups), { currency: true });

    Charts.donut('bank-gauge',
      [net >= 0 ? 'Net Positive' : 'Net Negative', 'Offset'],
      [Math.abs(netPct), 100 - Math.abs(netPct)],
      {
        cutout: '72%',
        circumference: Math.PI,
        rotation: -Math.PI / 2 * 180 / Math.PI * -1,
        centerText: netPct.toFixed(0) + '%',
        centerSub:  'Net ratio',
        centerColor: net >= 0 ? C.green : C.red
      }
    );

    const bankGroups = {};
    rows.forEach(r => {
      const k = groupKey(r['Bank Name'] || 'Other');
      if (!bankGroups[k]) bankGroups[k] = { pos: 0, neg: 0 };
      const a = r['Amount'] || 0;
      a >= 0 ? bankGroups[k].pos += a : bankGroups[k].neg += Math.abs(a);
    });
    const bgKeys = Object.keys(bankGroups);
    Charts.bar('bank-stacked', bgKeys, [
      { label: 'Credit',    data: bgKeys.map(k => bankGroups[k].pos), colors: bgKeys.map(() => C.green + 'bb') },
      { label: 'Liability', data: bgKeys.map(k => bankGroups[k].neg), colors: bgKeys.map(() => C.red   + '88') }
    ], { stacked: true, currency: true });

    rows._renderer = r => {
      const amt = r['Amount'] || 0;
      const f   = freshnessAge(r['Last Updated']);
      return `<tr>
        <td>${r['Bank Name'] || '—'}</td>
        <td style="font-size:.7rem;font-variant-numeric:tabular-nums">${r['Account Number'] || '—'}</td>
        <td>${r['Account Type'] || '—'}</td>
        <td class="num ${amt < 0 ? 'text-red' : amt === 0 ? 'text-muted' : 'text-green'}">Rs. ${fmtLKR(amt)}</td>
        <td>${fmtDate(r['Last Updated'])}</td>
        <td>${statusBadge(f.label, f.pill)}</td>
      </tr>`;
    };
    renderRowsInto(document.getElementById('bank-tbody'), rows, rows._renderer);
    makeTableSortable('bank-tbl', 'bank-search', rows);
  }

  renderView(allRows);
  compSel?.addEventListener('change', () => { Sound.click(); renderView(getFiltered()); });
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 2 — CASH IN HAND
═══════════════════════════════════════════════ */
async function initCashPage() {
  Sound.load();
  const d=await Sheets.fetch(TABS.cash);
  if (!d?.rows.length){ showNoData('pg-cash',TABS.cash,'No cash data'); return; }
  const rows=d.rows;
  const total=rows.reduce((s,r)=>s+(r['Amount']||0),0);
  const maxRow=rows.reduce((m,r)=>(r['Amount']||0)>(m['Amount']||0)?r:m,rows[0]);

  renderKPIs('cash-kpis',[
    {icon:'💰',label:'Total Cash in Hand',value:'Rs. '+fmtLKRFull(total),               color:'green'},
    {icon:'📍',label:'Number of Floats',  value:rows.length,                             color:'blue'},
    {icon:'⭐',label:'Largest Float',     value:'Rs. '+fmtLKRFull(maxRow['Amount']||0), color:'purple'},
    {icon:'📊',label:'Average Float',     value:'Rs. '+fmtLKRFull(total/rows.length),   color:'amber'}
  ]);
  setTableCount('cash-count',rows.length);

  const labels=rows.map(r=>r['Cash Float Name']||'—');
  const vals=rows.map(r=>r['Amount']||0);
  Charts.bar('cash-bar',labels,[{label:'Cash (LKR)',data:vals,colors:C.PALETTE.slice(0,vals.length).map(c=>c+'cc')}],{horizontal:true,currency:true});
  Charts.donut('cash-donut',labels,vals,{currency:true});

  rows._renderer=r=>{
    const f=freshnessAge(r['Last Updated']);
    return `<tr>
      <td>${r['Cash Float Name']||'—'}</td>
      <td class="num text-green">Rs. ${fmtLKR(r['Amount']||0)}</td>
      <td>${fmtDate(r['Last Updated'])}</td>
      <td>${statusBadge(f.label,f.pill)}</td>
    </tr>`;
  };
  renderRowsInto(document.getElementById('cash-tbody'),rows,rows._renderer);
  makeTableSortable('cash-tbl','cash-search',rows);
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 3 — INVOICE RECEIVABLES
═══════════════════════════════════════════════ */
async function initInvoicesPage() {
  Sound.load();
  const d = await Sheets.fetch(TABS.invoices);
  if (!d?.rows.length) { showNoData('pg-invoices', TABS.invoices, 'No invoice data'); return; }
  const allRows = d.rows;

  const statusCol = d.cols[9] || 'Status';
  const getStatus = r => String(r[statusCol] || '').trim().toLowerCase();

  const companyCol = d.cols[12] || 'Company Name';
  const companies = [...new Set(allRows.map(r => r[companyCol]).filter(Boolean))].sort();
  const compSel = document.getElementById('inv-company-sel');
  if (compSel) {
    compSel.innerHTML = '<option value="">All Companies</option>' +
      companies.map(c => `<option value="${c}">${c}</option>`).join('');
    compSel.onchange = function () {
      Sound.click();
      renderView(this.value ? allRows.filter(r => r[companyCol] === this.value) : allRows);
    };
  }

  function renderView(rows) {
    const pendingRows  = rows.filter(r => getStatus(r) === 'pending');
    const receivedRows = rows.filter(r => getStatus(r) === 'received');

    const totalAmt    = rows.reduce((s, r) => s + (r['Invoice Amount'] || 0), 0);
    const pendingAmt  = pendingRows.reduce((s, r) => s + (r['Invoice Amount'] || 0), 0);
    const receivedAmt = receivedRows.reduce((s, r) => s + (r['Invoice Amount'] || 0), 0);
    const collectionRate = totalAmt ? (receivedAmt / totalAmt * 100) : 0;

    renderKPIs('inv-kpis', [
      { icon: '💼', label: 'Total Invoiced Amount', value: 'Rs. ' + fmtLKRFull(totalAmt),    color: 'blue'  },
      { icon: '⏳', label: 'Pending Amount',         value: 'Rs. ' + fmtLKRFull(pendingAmt),  color: 'red'   },
      { icon: '✅', label: 'Received Amount',        value: 'Rs. ' + fmtLKRFull(receivedAmt), color: 'green' },
      { icon: '📊', label: 'Collection Rate',        value: collectionRate.toFixed(1) + '%',
        color: collectionRate >= 75 ? 'green' : collectionRate >= 50 ? 'amber' : 'red' }
    ]);
    setTableCount('inv-count', rows.length);

    const buckets = { '0–30d': 0, '31–60d': 0, '61–90d': 0, '91+d': 0 };
    pendingRows.forEach(r => {
      const age = r['Age Days'] || 0, amt = r['Invoice Amount'] || 0;
      if (age <= 30)      buckets['0–30d']  += amt;
      else if (age <= 60) buckets['31–60d'] += amt;
      else if (age <= 90) buckets['61–90d'] += amt;
      else                buckets['91+d']   += amt;
    });
    Charts.bar('inv-age', Object.keys(buckets), [
      { label: 'Pending Amount (LKR)', data: Object.values(buckets),
        colors: [C.green + 'cc', C.amber + 'cc', C.red + '99', C.red + 'dd'] }
    ], { currency: true });

    const byClientPending = {};
    pendingRows.forEach(r => {
      const ref = String(r['Client Ref'] || 'Unknown').split('/')[0];
      byClientPending[ref] = (byClientPending[ref] || 0) + (r['Invoice Amount'] || 0);
    });
    const pendingClientKeys = Object.keys(byClientPending).sort((a, b) => byClientPending[b] - byClientPending[a]);
    Charts.bar('inv-client', pendingClientKeys, [
      { label: 'Pending (LKR)', data: pendingClientKeys.map(k => byClientPending[k]),
        colors: pendingClientKeys.map(() => C.red + 'cc') }
    ], { horizontal: true, currency: true });

    const clientMap = {};
    rows.forEach(r => {
      const ref = String(r['Client Ref'] || 'Unknown').split('/')[0];
      if (!clientMap[ref]) clientMap[ref] = { received: 0, pending: 0 };
      getStatus(r) === 'received'
        ? clientMap[ref].received += (r['Invoice Amount'] || 0)
        : clientMap[ref].pending  += (r['Invoice Amount'] || 0);
    });
    const clientKeys = Object.keys(clientMap);
    Charts.bar('inv-scatter', clientKeys, [
      { label: 'Received', data: clientKeys.map(k => clientMap[k].received), colors: clientKeys.map(() => C.green + 'aa') },
      { label: 'Pending',  data: clientKeys.map(k => clientMap[k].pending),  colors: clientKeys.map(() => C.red  + 'aa') }
    ], { stacked: true, currency: true });

    Charts.donut('inv-status', ['Received', 'Pending'], [receivedAmt, pendingAmt], { currency: true });

    rows._renderer = r => {
      const age = r['Age Days'] || 0;
      const isPending = getStatus(r) === 'pending';
      const aCls = isPending ? (age <= 30 ? 'green' : age <= 60 ? 'amber' : 'red') : 'muted';
      const sb = isPending
        ? (age <= 30
            ? statusBadge('Pending', 'amber')
            : age <= 60
              ? statusBadge('30d+ Pending', 'amber')
              : statusBadge('Overdue', 'red'))
        : statusBadge('Received', 'green');
      const company = r[companyCol] || '—';
      return `<tr>
        <td><button class="expand-btn">▶</button></td>
        <td>${r['Invoice Number'] || '—'}</td>
        <td>${fmtDate(r['Invoice Date'])}</td>
        <td class="num">Rs. ${fmtLKR(r['Invoice Amount'] || 0)}</td>
        <td class="num text-${aCls}">${isPending ? age : '—'}</td>
        <td>${r['Client Ref'] || '—'}</td>
        <td>${fmtDate(r['Received Date']) || '<span class="text-muted">Pending</span>'}</td>
        <td>${sb}</td>
      </tr><tr class="expand-row" style="display:none"><td colspan="8">
        <div class="expand-content">
          <div class="expand-field"><div class="expand-field-label">Company</div><div class="expand-field-val">${company}</div></div>
          <div class="expand-field"><div class="expand-field-label">Tender No</div><div class="expand-field-val">${r['Tender No'] || '—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Pole Type</div><div class="expand-field-val">${r['Pole Type'] || '—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Mfg. Location</div><div class="expand-field-val">${r['Manufactured Location'] || '—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Tender Qty</div><div class="expand-field-val">${r['Tender Qty'] || '—'}</div></div>
        </div>
      </td></tr>`;
    };
    renderRowsInto(document.getElementById('inv-tbody'), rows, rows._renderer);
    makeTableSortable('inv-tbl', 'inv-search', rows);
  }

  renderView(allRows);
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 4 — FINANCE LIABILITY
═══════════════════════════════════════════════ */
async function initFinancePage() {
  Sound.load();
  const d = await Sheets.fetch(TABS.finance);
  if (!d?.rows.length) { showNoData('pg-finance', TABS.finance, 'No finance data'); return; }

  const allRows = d.rows;

  const totalGranted  = allRows.reduce((s, r) => s + (r['Loan Granted Amount'] || 0), 0);
  const totalOuts     = allRows.reduce((s, r) => s + (r['Capital Outstanding']  || 0), 0);
  const totalMonthly  = allRows.reduce((s, r) => s + (r['Monthly Installment']  || 0), 0);
  const repaidPct     = totalGranted ? (totalGranted - totalOuts) / totalGranted * 100 : 0;

  renderKPIs('fin-kpis', [
    { icon: '🏦', label: 'Total Loans Granted',  value: 'Rs. ' + fmtLKRFull(totalGranted), color: 'blue'  },
    { icon: '💳', label: 'Total Outstanding',    value: 'Rs. ' + fmtLKRFull(totalOuts),    color: 'red'   },
    { icon: '📅', label: 'Monthly Obligations',  value: 'Rs. ' + fmtLKRFull(totalMonthly), color: 'amber' },
    { icon: '✅', label: 'Portfolio Repaid',     value: repaidPct.toFixed(1) + '%',         color: 'green' }
  ]);
  setTableCount('fin-count', allRows.length);

  function abbrevBankName(name) {
    return (name || '—')
      .replace('Sampath Bank-', 'Sampath ')
      .replace('Seylan – ', 'Seylan ')
      .replace('Seylan - ', 'Seylan ');
  }

  const bankNames = [...new Set(allRows.map(r => (r['Bank Name'] || '').trim()).filter(Boolean))].sort();
  const bankSel   = document.getElementById('fin-bank-filter');
  if (bankSel) {
    bankSel.innerHTML =
      '<option value="">All Banks</option>' +
      bankNames.map(b => `<option value="${b}">${b}</option>`).join('');
  }

  function renderFinBar(rows) {
    const barLabels = rows.map(r => abbrevBankName(r['Bank Name']));
    Charts.bar(
      'fin-bar',
      barLabels,
      [{ label: 'Outstanding (LKR)', data: rows.map(r => r['Capital Outstanding'] || 0) }],
      { horizontal: true, currency: true }
    );
  }

  function renderMonthlyBar(rows) {
    const byType = {};
    rows.forEach(r => {
      const t = r['Loan Type'] || 'Other';
      byType[t] = (byType[t] || 0) + (r['Monthly Installment'] || 0);
    });
    const typeKeys = Object.keys(byType);
    Charts.bar(
      'fin-monthly',
      typeKeys,
      [{
        label: 'Monthly Instalment (LKR)',
        data:  typeKeys.map(k => byType[k]),
        colors: typeKeys.map((_, i) => C.PALETTE[i % C.PALETTE.length] + 'cc')
      }],
      { currency: true }
    );
  }

  renderFinBar(allRows);
  renderMonthlyBar(allRows);

  bankSel?.addEventListener('change', () => {
    Sound.click();
    const chosen = bankSel.value;
    const filtered = chosen
      ? allRows.filter(r => (r['Bank Name'] || '').trim() === chosen)
      : allRows;
    renderFinBar(filtered);
  });

  allRows._renderer = r => {
    const granted = r['Loan Granted Amount'] || 0;
    const outs    = r['Capital Outstanding']  || 0;
    const pct     = granted ? Math.round((granted - outs) / granted * 100) : 0;
    const ltype   = r['Loan Type'] || '—';
    const sCls    = ltype.toLowerCase().includes('leas')  ? 'purple'
                  : ltype.toLowerCase().includes('agro')  ? 'green'
                  : 'blue';
    return `<tr>
      <td><button class="expand-btn">▶</button></td>
      <td>${r['Bank Name'] || '—'}</td>
      <td style="font-size:.7rem;font-variant-numeric:tabular-nums">${r['Loan Account No'] || '—'}</td>
      <td>${statusBadge(ltype, sCls)}</td>
      <td class="num">Rs. ${fmtLKR(granted)}</td>
      <td class="num text-red">Rs. ${fmtLKR(outs)}</td>
      <td class="num text-muted">${(r['Age Days'] || 0).toLocaleString()}d</td>
      <td>${progressBar(pct)}</td>
    </tr><tr class="expand-row" style="display:none"><td colspan="8">
      <div class="expand-content">
        <div class="expand-field"><div class="expand-field-label">Granted Date</div><div class="expand-field-val">${fmtDate(r['Granted Date'])}</div></div>
        <div class="expand-field"><div class="expand-field-label">Monthly Instalment</div><div class="expand-field-val">Rs. ${fmtLKR(r['Monthly Installment'] || 0)}</div></div>
        <div class="expand-field"><div class="expand-field-label">% Repaid</div><div class="expand-field-val">${pct}%</div></div>
        <div class="expand-field"><div class="expand-field-label">Balance</div><div class="expand-field-val">Rs. ${fmtLKR(outs, true)}</div></div>
      </div>
    </td></tr>`;
  };
  renderRowsInto(document.getElementById('fin-tbody'), allRows, allRows._renderer);
  makeTableSortable('fin-tbl', 'fin-search', allRows);

  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 5 — TENDER / PRODUCTION
═══════════════════════════════════════════════ */
async function initTenderPage() {
  Sound.load();
  const [dComp,dOngo]=await Promise.all([Sheets.fetch(TABS.tenderCompleted),Sheets.fetch(TABS.tenderOngoing)]);
  if (!dComp?.rows.length&&!dOngo?.rows.length){ showNoData('pg-tender',TABS.tenderOngoing,'No tender data'); return; }

  const completedRows=(dComp?.rows||[]).map(r=>({...r,_tabStatus:'Completed'}));
  const ongoingRows=(dOngo?.rows||[]).map(r=>({...r,_tabStatus:'On-Going'}));
  const allRows=[...ongoingRows,...completedRows];

  const siteEl=document.getElementById('tender-site');
  const statusEl=document.getElementById('tender-status');

  const allSites=[...new Set(allRows.map(r=>r['Site Name']).filter(Boolean))].sort();
  if (siteEl) {
    siteEl.innerHTML='<option value="">All Sites</option>'+
      allSites.map(s=>`<option value="${s}">${s}</option>`).join('');
  }

  let activeRows=allRows;

  function renderView(rows) {
    activeRows=rows;
    const active=rows.filter(r=>r._tabStatus==='On-Going').length;
    const completed=rows.filter(r=>r._tabStatus==='Completed').length;
    const totalQty=rows.reduce((s,r)=>s+(r['Total Tender Qty']||r['Tender Qty']||0),0);
    const castQty=rows.reduce((s,r)=>s+(r['Total Qty Casted']||0),0);

    renderKPIs('tender-kpis',[
      {icon:'🔨',label:'On-Going Tenders', value:active,                             color:'blue'},
      {icon:'✅',label:'Completed',         value:completed,                          color:'green'},
      {icon:'📦',label:'Total Tender Qty', value:totalQty.toLocaleString()+' poles', color:'purple'},
      {icon:'🏭',label:'Total Casted',     value:castQty.toLocaleString()+' poles',  color:'amber'}
    ]);
    setTableCount('tender-count',rows.length);

    const selStatus=statusEl?.value;
    if (selStatus==='Completed') {
      const slice=rows.slice(0,12);
      Charts.bar('tender-progress',slice.map(r=>r['Tender No']||'—'),[{
        label:'Total Qty (poles)',
        data:slice.map(r=>r['Total Tender Qty']||r['Tender Qty']||0),
        colors:slice.map(()=>C.green+'cc')
      }],{unit:' poles'});
    } else {
      const og=rows.filter(r=>r._tabStatus==='On-Going').slice(0,12);
      if (og.length) {
        const pcts=og.map(r=>{ const t=r['Total Tender Qty']||1,c=r['Total Qty Casted']||0; return Math.min(100,c/t*100); });
        Charts.bar('tender-progress',og.map(r=>r['Tender No']||'—'),[{
          label:'% Complete',
          data:pcts,
          colors:pcts.map(p=>p>=90?C.green+'cc':p>=50?C.primary+'cc':C.amber+'cc')
        }]);
      } else {
        const slice=rows.slice(0,12);
        Charts.bar('tender-progress',slice.map(r=>r['Tender No']||'—'),[{
          label:'Total Qty (poles)',
          data:slice.map(r=>r['Total Tender Qty']||r['Tender Qty']||0),
          colors:slice.map(()=>C.green+'cc')
        }],{unit:' poles'});
      }
    }

    const bySite={};
    rows.forEach(r=>{ const s=r['Site Name']||'Unknown'; bySite[s]=(bySite[s]||0)+1; });
    Charts.donut('tender-donut',Object.keys(bySite),Object.values(bySite));

    const dynSites=[...new Set(rows.map(r=>r['Site Name']).filter(Boolean))];
    const siteQty=dynSites.map(s=>rows.filter(r=>r['Site Name']===s).reduce((acc,r)=>acc+(r['Total Tender Qty']||r['Tender Qty']||0),0));
    if (dynSites.length) Charts.polar('tender-radar',dynSites,siteQty,{unit:' poles'});

    rows._renderer=r=>{
      const isOng=r._tabStatus==='On-Going';
      const tot=r['Total Tender Qty']||r['Tender Qty']||0, cast=r['Total Qty Casted']||0;
      const pct=tot?Math.round(cast/tot*100):(r._tabStatus==='Completed'?100:0);
      return `<tr>
        <td><button class="expand-btn">▶</button></td>
        <td>${r['Tender No']||'—'}</td>
        <td>${r['Site Name']||'—'}</td>
        <td>${r['Pole Type']||'—'}</td>
        <td>${statusBadge(r._tabStatus,r._tabStatus==='Completed'?'green':'blue')}</td>
        <td>${progressBar(pct)}</td>
        <td class="num">${tot.toLocaleString()}</td>
        <td class="num">${cast.toLocaleString()}</td>
      </tr><tr class="expand-row" style="display:none"><td colspan="8">
        <div class="expand-content">
          <div class="expand-field"><div class="expand-field-label">Status Detail</div><div class="expand-field-val">${isOng?r['Production Status']||'—':r['Tender Status']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Start Date</div><div class="expand-field-val">${fmtDate(r['Production Start Date'])}</div></div>
          ${isOng?`
          <div class="expand-field"><div class="expand-field-label">Day Plan</div><div class="expand-field-val">${r['Day Plan']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Balance to Cast</div><div class="expand-field-val">${(r['Balance To Cast']||0).toLocaleString()} poles</div></div>
          <div class="expand-field"><div class="expand-field-label">Remaining Days</div><div class="expand-field-val">${r['Remaining Days']||'—'}</div></div>`:''}
        </div>
      </td></tr>`;
    };
    renderRowsInto(document.getElementById('tender-tbody'),rows,rows._renderer);
  }

  renderView(allRows);

  const tbl=document.getElementById('tender-tbl');
  const se=document.getElementById('tender-search');
  let tSortCol=null, tSortDir=1;
  function tSorted(rows) {
    if (!tSortCol) return rows;
    return [...rows].sort((a,b)=>{
      const av=a[tSortCol],bv=b[tSortCol];
      if (av==null) return 1; if (bv==null) return -1;
      if (av instanceof Date&&bv instanceof Date) return (av-bv)*tSortDir;
      if (typeof av==='number'&&typeof bv==='number') return (av-bv)*tSortDir;
      return String(av).localeCompare(String(bv))*tSortDir;
    });
  }
  tbl?.querySelectorAll('thead th[data-col]').forEach(th=>{
    th.addEventListener('click',()=>{
      Sound.click();
      const col=th.dataset.col;
      if (tSortCol===col) tSortDir*=-1; else { tSortCol=col; tSortDir=1; }
      tbl.querySelectorAll('thead th').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(tSortDir===1?'sort-asc':'sort-desc');
      renderRowsInto(tbl.querySelector('tbody'),tSorted(filterRows(activeRows,se?.value||'')),activeRows._renderer);
    });
  });
  se?.addEventListener('input',()=>{
    renderRowsInto(tbl.querySelector('tbody'),tSorted(filterRows(activeRows,se.value)),activeRows._renderer);
  });

  function applyFilters(){
    Sound.click();
    let rows=allRows;
    const site=siteEl?.value, status=statusEl?.value;
    if (site)   rows=rows.filter(r=>(r['Site Name']||'')===site);
    if (status) rows=rows.filter(r=>r._tabStatus===status);
    renderView(rows);
  }
  siteEl?.addEventListener('change',applyFilters);
  statusEl?.addEventListener('change',applyFilters);
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 6 — SLEEPERS PRODUCTION
═══════════════════════════════════════════════ */
async function initSleepersPage() {
  Sound.load();
  const [dComp,dOngo]=await Promise.all([Sheets.fetch(TABS.sleepersCompleted),Sheets.fetch(TABS.sleepersOngoing)]);
  if (!dComp?.rows.length&&!dOngo?.rows.length){ showNoData('pg-sleepers',TABS.sleepersOngoing,'No sleeper production data'); return; }

  const completedRows=(dComp?.rows||[]).map(r=>({
    ...r, _tabStatus:'Completed',
    'Total Tender Qty':r['Tender Qty']||0,
    'Total Qty Casted':r['Tender Qty']||0,
    'Balance To Cast':0
  }));
  const ongoingRows=(dOngo?.rows||[]).map(r=>({...r,_tabStatus:'On-Going'}));
  const allRows=[...ongoingRows,...completedRows];

  const siteEl=document.getElementById('slp-site');
  const statusEl=document.getElementById('slp-status');

  const allSites=[...new Set(allRows.map(r=>r['Site Name']).filter(Boolean))].sort();
  if (siteEl) {
    siteEl.innerHTML='<option value="">All Sites</option>'+
      allSites.map(s=>`<option value="${s}">${s}</option>`).join('');
  }

  let activeRows=allRows;

  function renderView(rows) {
    activeRows=rows;
    const active=rows.filter(r=>r._tabStatus==='On-Going').length;
    const completed=rows.filter(r=>r._tabStatus==='Completed').length;
    const totalQty=rows.reduce((s,r)=>s+(r['Total Tender Qty']||0),0);
    const castQty=rows.reduce((s,r)=>s+(r['Total Qty Casted']||0),0);

    renderKPIs('slp-kpis',[
      {icon:'🚂',label:'On-Going Jobs',     value:active,                              color:'blue'},
      {icon:'✅',label:'Completed',          value:completed,                           color:'green'},
      {icon:'🛤️',label:'Total Sleeper Qty', value:totalQty.toLocaleString()+' pcs',    color:'purple'},
      {icon:'🏭',label:'Total Casted',       value:castQty.toLocaleString()+' pcs',    color:'amber'}
    ]);
    setTableCount('slp-count',rows.length);

    Charts.destroy('slp-combined');
    const allTenders=rows.slice(0,16);
    const slpLabels=allTenders.map(r=>{
      const isOng=r._tabStatus==='On-Going';
      return (r['Tender No']||'—')+(isOng?'':' ✓');
    });
    const slpCasted=allTenders.map(r=>r['Total Qty Casted']||0);
    const slpBalance=allTenders.map(r=>Math.max(0,(r['Balance To Cast']!==undefined&&r['Balance To Cast']!==null)?r['Balance To Cast']:((r['Total Tender Qty']||0)-(r['Total Qty Casted']||0))));
    const slpCompleted=allTenders.map(r=>r._tabStatus==='Completed');
    Charts.bar('slp-combined',slpLabels,[
      {label:'Casted (pcs)',         data:slpCasted,  colors:slpCompleted.map(c=>c?C.green+'ee':C.green+'bb')},
      {label:'Balance to Cast (pcs)',data:slpBalance, colors:slpCompleted.map(c=>c?C.green+'18':C.amber+'99')}
    ],{horizontal:true,stacked:true,unit:' pcs'});

    const ogRows=rows.filter(r=>r._tabStatus==='On-Going');
    if (ogRows.length===1) {
      const t=ogRows[0];
      const totalQ=t['Total Tender Qty']||0;
      const casted=t['Total Qty Casted']||0;
      const balance=Math.max(0,t['Balance To Cast']||(totalQ-casted));
      const dayPlan=t['Day Plan']||0;
      const remaining=parseFloat(t['Remaining Days'])||0;
      Charts.bar('slp-stacked',
        ['Total Qty','Qty Casted','Balance to Cast','Day Plan','Days Remaining×Plan'],
        [{label:'Sleeper Production Metrics',
          data:[totalQ,casted,balance,dayPlan,Math.round(remaining*dayPlan)],
          colors:[C.blue+'cc',C.green+'cc',C.amber+'cc',C.primary+'cc',C.red+'88']}],
        {unit:' pcs'}
      );
    } else {
      const dynSites=[...new Set(rows.map(r=>r['Site Name']).filter(Boolean))];
      if (dynSites.length) {
        const siteCasted=dynSites.map(s=>rows.filter(r=>r['Site Name']===s).reduce((a,r)=>a+(r['Total Qty Casted']||0),0));
        const siteBalance=dynSites.map(s=>rows.filter(r=>r['Site Name']===s).reduce((a,r)=>a+(r['Balance To Cast']||0),0));
        Charts.bar('slp-stacked',dynSites,[
          {label:'Casted',           data:siteCasted,  colors:dynSites.map(()=>C.green+'cc')},
          {label:'Balance to Cast',  data:siteBalance, colors:dynSites.map(()=>C.amber+'cc')}
        ],{stacked:true,unit:' pcs'});
      }
    }

    rows._renderer=r=>{
      const isOng=r._tabStatus==='On-Going';
      const tot=r['Total Tender Qty']||0, cast=r['Total Qty Casted']||0;
      const pct=tot?Math.round(cast/tot*100):(r._tabStatus==='Completed'?100:0);
      const sleeperType=r['Sleeper Type']||r['Pole Type']||'—';
      return `<tr>
        <td><button class="expand-btn">▶</button></td>
        <td>${r['Tender No']||'—'}</td>
        <td>${r['Site Name']||'—'}</td>
        <td>${sleeperType}</td>
        <td>${statusBadge(r._tabStatus,r._tabStatus==='Completed'?'green':'blue')}</td>
        <td>${progressBar(pct)}</td>
        <td class="num">${tot.toLocaleString()}</td>
        <td class="num">${cast.toLocaleString()}</td>
      </tr><tr class="expand-row" style="display:none"><td colspan="8">
        <div class="expand-content">
          <div class="expand-field"><div class="expand-field-label">Status Detail</div><div class="expand-field-val">${isOng?r['Production Status']||'—':r['Tender Status']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Start Date</div><div class="expand-field-val">${fmtDate(r['Production Start Date'])}</div></div>
          ${isOng?`
          <div class="expand-field"><div class="expand-field-label">Day Plan</div><div class="expand-field-val">${r['Day Plan']||'—'} pcs/day</div></div>
          <div class="expand-field"><div class="expand-field-label">Balance to Cast</div><div class="expand-field-val">${(r['Balance To Cast']||0).toLocaleString()} pcs</div></div>
          <div class="expand-field"><div class="expand-field-label">Remaining Days</div><div class="expand-field-val">${r['Remaining Days']||'—'}</div></div>`:''}
        </div>
      </td></tr>`;
    };
    renderRowsInto(document.getElementById('slp-tbody'),rows,rows._renderer);
  }

  renderView(allRows);

  const tbl=document.getElementById('slp-tbl');
  const se=document.getElementById('slp-search');
  let tSortCol=null, tSortDir=1;
  function tSorted(rows) {
    if (!tSortCol) return rows;
    return [...rows].sort((a,b)=>{
      const av=a[tSortCol],bv=b[tSortCol];
      if (av==null) return 1; if (bv==null) return -1;
      if (av instanceof Date&&bv instanceof Date) return (av-bv)*tSortDir;
      if (typeof av==='number'&&typeof bv==='number') return (av-bv)*tSortDir;
      return String(av).localeCompare(String(bv))*tSortDir;
    });
  }
  tbl?.querySelectorAll('thead th[data-col]').forEach(th=>{
    th.addEventListener('click',()=>{
      Sound.click();
      const col=th.dataset.col;
      if (tSortCol===col) tSortDir*=-1; else { tSortCol=col; tSortDir=1; }
      tbl.querySelectorAll('thead th').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(tSortDir===1?'sort-asc':'sort-desc');
      renderRowsInto(tbl.querySelector('tbody'),tSorted(filterRows(activeRows,se?.value||'')),activeRows._renderer);
    });
  });
  se?.addEventListener('input',()=>{
    renderRowsInto(tbl.querySelector('tbody'),tSorted(filterRows(activeRows,se.value)),activeRows._renderer);
  });

  function applyFilters(){
    Sound.click();
    let rows=allRows;
    const site=siteEl?.value, status=statusEl?.value;
    if (site)   rows=rows.filter(r=>(r['Site Name']||'')===site);
    if (status) rows=rows.filter(r=>r._tabStatus===status);
    renderView(rows);
  }
  siteEl?.addEventListener('change',applyFilters);
  statusEl?.addEventListener('change',applyFilters);
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 7 — VEHICLE FLEET
═══════════════════════════════════════════════ */
async function initVehiclePage() {
  Sound.load();
  const d=await Sheets.fetch(TABS.vehicle);
  if (!d?.rows.length){ showNoData('pg-vehicle',TABS.vehicle,'No vehicle data'); return; }
  const allRows=d.rows;

  function renderView(rows) {
    const totalDist=rows.reduce((s,r)=>s+(r['Total Distance (km)']||0),0);
    const totalFuel=rows.reduce((s,r)=>s+(r['Total Fuel Consumed (L)']||0),0);
    const active=new Set(rows.map(r=>r['Vehicle Number'])).size;
    const mRows=rows.filter(r=>r['Fuel Mileage (km/l)']);
    const avgMileage=mRows.length?mRows.reduce((s,r)=>s+(r['Fuel Mileage (km/l)']||0),0)/mRows.length:0;

    renderKPIs('veh-kpis',[
      {icon:'🛣️',label:'Total Distance',  value:Math.round(totalDist).toLocaleString()+' km', color:'blue'},
      {icon:'⛽',label:'Fuel Consumed',    value:totalFuel.toFixed(1)+' L',                    color:'amber'},
      {icon:'🚛',label:'Active Vehicles', value:active,                                         color:'green'},
      {icon:'📊',label:'Avg Mileage',     value:avgMileage.toFixed(1)+' km/L',                color:'purple'}
    ]);
    setTableCount('veh-count',rows.length);

    const byVeh={};
    rows.forEach(r=>{ const v=r['Vehicle Number']||'?'; byVeh[v]=(byVeh[v]||0)+(r['Total Distance (km)']||0); });
    Charts.bar('veh-km',Object.keys(byVeh),[{label:'Distance (km)',data:Object.values(byVeh),colors:Object.keys(byVeh).map((_,i)=>C.PALETTE[i%C.PALETTE.length]+'cc')}],{unit:' km'});

    const byVehFuel={};
    rows.forEach(r=>{ const v=r['Vehicle Number']||'?'; byVehFuel[v]=(byVehFuel[v]||0)+(r['Total Fuel Consumed (L)']||0); });
    Charts.bar('veh-fuel',Object.keys(byVehFuel),[{label:'Fuel (L)',data:Object.values(byVehFuel),colors:Object.keys(byVehFuel).map((_,i)=>C.PALETTE[(i+3)%C.PALETTE.length]+'cc')}],{unit:' L'});

    const scatterPts=rows.filter(r=>r['Fuel Mileage (km/l)']).map(r=>({ x:r['Total Distance (km)']||0, y:r['Fuel Mileage (km/l)']||0, label:r['Vehicle Number']||'' }));
    Charts.scatter('veh-scatter',[{label:'Vehicles',data:scatterPts,backgroundColor:C.primary+'88',borderColor:C.primary}],{xLabel:'Distance (km)',yLabel:'Mileage (km/L)'});

    Charts.polar('veh-polar',Object.keys(byVehFuel),Object.values(byVehFuel),{unit:' L'});

    rows._renderer=r=>{
      const dist=r['Total Distance (km)']||0, fuel=r['Total Fuel Consumed (L)']||0, mileage=r['Fuel Mileage (km/l)']||0;
      const mCls=mileage>=5?'green':mileage>=3.5?'amber':'red';
      return `<tr>
        <td><button class="expand-btn">▶</button></td>
        <td><strong>${r['Vehicle Number']||'—'}</strong></td>
        <td>${fmtDate(r['Date'])}</td>
        <td class="num">${dist.toFixed(0)} km</td>
        <td class="num">${r['Avg Speed (km/h)']||'—'} km/h</td>
        <td class="num text-${mCls}">${mileage.toFixed(1)} km/L</td>
        <td class="num">${fuel.toFixed(1)} L</td>
        <td>${statusBadge('Active','green')}</td>
      </tr><tr class="expand-row" style="display:none"><td colspan="8">
        <div class="expand-content">
          <div class="expand-field"><div class="expand-field-label">Route</div><div class="expand-field-val">${r['Start Location']||'?'} → ${r['End Location']||'?'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Movement</div><div class="expand-field-val">${r['Movement Start']||'—'} – ${r['Movement End']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Top Speed</div><div class="expand-field-val">${r['Top Speed (km/h)']||'—'} km/h</div></div>
          <div class="expand-field"><div class="expand-field-label">Engine Time</div><div class="expand-field-val">${r['Total Engine Time']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Idle Duration</div><div class="expand-field-val">${r['Total Idle Duration']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Start Fuel</div><div class="expand-field-val">${r['Start Fuel Level']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">End Fuel</div><div class="expand-field-val">${r['End Fuel Level']||'—'}</div></div>
          <div class="expand-field"><div class="expand-field-label">Refuel</div><div class="expand-field-val">${r['Total Refuel (L)']||'—'} L</div></div>
        </div>
      </td></tr>`;
    };
    renderRowsInto(document.getElementById('veh-tbody'),rows,rows._renderer);
    makeTableSortable('veh-tbl','veh-search',rows);
  }

  renderView(allRows);
  document.getElementById('vehicle-sel')?.addEventListener('change',function(){
    Sound.click();
    renderView(this.value?allRows.filter(r=>r['Vehicle Number']===this.value):allRows);
  });
  Sound.success();
}

/* ═══════════════════════════════════════════════
   PAGE 8 — FILLING STATION
═══════════════════════════════════════════════ */
async function initFillingPage() {
  Sound.load();
  const d=await Sheets.fetch(TABS.filling);
  if (!d?.rows.length){ showNoData('pg-filling',TABS.filling,'No filling station data'); return; }
  const rows=d.rows;
  const latest=rows[rows.length-1];

  const TANK_MAX={petrol:20000,diesel:30000,euro3:15000,extramile:10000};
  [
    {id:'petrol',   col:'Petrol Stock'},
    {id:'diesel',   col:'Diesel Stock'},
    {id:'euro3',    col:'Euro 3 Stock'},
    {id:'extramile',col:'Extra Mile Stock'}
  ].forEach(t=>{
    const stock=latest[t.col]||0;
    const pct=Math.min(100,Math.max(0,stock/TANK_MAX[t.id]*100));
    const fillEl=document.getElementById(`ffill-${t.id}`);
    const pctEl=document.getElementById(`fpct-${t.id}`);
    const stEl=document.getElementById(`fstock-${t.id}`);
    State.tankLevels[t.id]=pct;
    if (fillEl) setTimeout(()=>{ fillEl.style.height=pct+'%'; },500);
    if (pctEl)  pctEl.textContent=pct.toFixed(0)+'%';
    if (stEl)   stEl.textContent=(stock||0).toLocaleString()+' L';
  });

  const totRev=rows.reduce((s,r)=>s+(r['Petrol Sales (LKR)']||0)+(r['Diesel Sales (LKR)']||0)+(r['Euro 3 Sales (LKR)']||0)+(r['Extra Mile Sales (LKR)']||0),0);
  const totVol=rows.reduce((s,r)=>s+(r['Petrol Sales (L)']||0)+(r['Diesel Sales (L)']||0)+(r['Euro 3 Sales (L)']||0)+(r['Extra Mile Sales (L)']||0),0);
  const creditBal=rows.reduce((s,r)=>s+(r['Credit Sales']||0),0);

  renderKPIs('fill-kpis',[
    {icon:'💰',label:'Total Revenue',    value:'Rs. '+fmtLKRFull(totRev),    color:'green'},
    {icon:'🛢️',label:'Total Volume (L)',value:Math.round(totVol).toLocaleString()+' L', color:'blue'},
    {icon:'📋',label:'Credit Balance',  value:'Rs. '+fmtLKRFull(creditBal), color:'amber'},
    {icon:'📅',label:'Records',         value:rows.length+' days',           color:'purple'}
  ]);
  setTableCount('fill-count',rows.length);

  const fuelTypes=['Petrol','Diesel','Euro 3','Extra Mile'];
  const revVals=fuelTypes.map(f=>rows.reduce((s,r)=>s+(r[`${f} Sales (LKR)`]||0),0));
  Charts.bar('fill-rev',fuelTypes,[{label:'Revenue (LKR)',data:revVals,colors:[C.blue+'cc',C.amber+'cc',C.green+'cc',C.red+'cc']}],{currency:true});

  const sTypes=['Cash Sales','Card Sales','Bank Transfers','Credit Sales'];
  Charts.donut('fill-sales',sTypes,sTypes.map(k=>latest[k]||0),{currency:true});

  const volVals=fuelTypes.map(f=>rows.reduce((s,r)=>s+(r[`${f} Sales (L)`]||0),0));
  Charts.bar('fill-vol',fuelTypes,[{label:'Volume (L)',data:volVals,colors:[C.blue+'cc',C.amber+'cc',C.green+'cc',C.red+'cc']}],{unit:' L'});

  const cb={'0–30d':0,'31–60d':0,'61–90d':0,'91+d':0};
  rows.forEach(r=>{ const age=daysAgo(r['Date'])||0, cr=r['Credit Sales']||0;
    if(age<=30)cb['0–30d']+=cr; else if(age<=60)cb['31–60d']+=cr; else if(age<=90)cb['61–90d']+=cr; else cb['91+d']+=cr;
  });
  Charts.bar('fill-credit',Object.keys(cb),[{label:'Credit (LKR)',data:Object.values(cb),colors:[C.green+'cc',C.amber+'cc',C.red+'99',C.red+'dd']}],{currency:true});

  rows._renderer=r=>{
    const totR=(r['Petrol Sales (LKR)']||0)+(r['Diesel Sales (LKR)']||0)+(r['Euro 3 Sales (LKR)']||0)+(r['Extra Mile Sales (LKR)']||0);
    return `<tr>
      <td>${fmtDate(r['Date'])}</td>
      <td class="num">${(r['Petrol Sales (L)']||0).toFixed(0)}</td>
      <td class="num">Rs. ${fmtLKR(r['Petrol Sales (LKR)']||0,true)}</td>
      <td class="num">${(r['Diesel Sales (L)']||0).toFixed(0)}</td>
      <td class="num">Rs. ${fmtLKR(r['Diesel Sales (LKR)']||0,true)}</td>
      <td class="num text-green">Rs. ${fmtLKR(totR,true)}</td>
    </tr>`;
  };
  renderRowsInto(document.getElementById('fill-tbody'),rows,rows._renderer);
  makeTableSortable('fill-tbl','fill-search',rows);
  Sound.success();
}

/* ═══════════════════════════════════════════════
   FUEL TANK — BUBBLES, SHAKE, TOUCH EFFECTS
═══════════════════════════════════════════════ */
const TANK_IDS = ['petrol','diesel','euro3','extramile'];
const _bubbleIntervals = {};

function spawnBubble(tankId) {
  const tank   = document.getElementById(`ftank-${tankId}`);
  if (!tank) return;
  const pct    = State.tankLevels[tankId] || 0;
  if (pct < 6)  return;

  const tankH  = tank.offsetHeight || 180;
  const fillH  = (pct / 100) * tankH;

  const el     = document.createElement('div');
  el.className = 'bubble';

  const size   = Math.random() * 5 + 1.5;
  const leftPct= Math.random() * 55 + 12;
  const startBt= Math.random() * fillH * 0.4;
  const riseH  = -(fillH * (0.55 + Math.random() * 0.4));
  const drift  = (Math.random() - 0.5) * 10;
  const dur    = Math.random() * 1.8 + 1.0;

  el.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    `left:${leftPct}%`,
    `bottom:${startBt}px`,
    `--brise:${riseH.toFixed(1)}px`,
    `--bdrift:${drift.toFixed(1)}px`,
    `animation:bubbleRise ${dur.toFixed(2)}s ease-in forwards`
  ].join(';');

  tank.appendChild(el);
  setTimeout(() => el.remove(), dur * 1000 + 120);
}

function startBubbleLoop(tankId) {
  if (_bubbleIntervals[tankId]) return;
  _bubbleIntervals[tankId] = setInterval(() => {
    const count = Math.ceil(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnBubble(tankId), Math.random() * 700);
    }
  }, 1100);
}

function shakeTank(tankId, wobble = true) {
  const tank   = document.getElementById(`ftank-${tankId}`);
  const fillEl = document.getElementById(`ffill-${tankId}`);
  if (!tank) return;

  tank.classList.add('shaking', 'touched');

  if (wobble && fillEl) {
    const orig  = State.tankLevels[tankId] || 0;
    const swing = 3 + Math.random() * 5;
    const dir   = Math.random() > 0.5 ? 1 : -1;

    fillEl.style.transition = 'height 0.09s ease';
    fillEl.style.height = `${Math.min(100, orig + swing * dir)}%`;

    setTimeout(() => {
      fillEl.style.height = `${Math.max(0, orig - swing * 0.45 * dir)}%`;
    }, 110);

    setTimeout(() => {
      fillEl.style.transition = 'height 2s cubic-bezier(.34,1.15,.64,1)';
      fillEl.style.height = `${orig}%`;
    }, 260);
  }

  for (let i = 0; i < 4; i++) {
    setTimeout(() => spawnBubble(tankId), i * 90);
  }

  setTimeout(() => tank.classList.remove('shaking', 'touched'), 900);
}

function shakeAllTanks() {
  Sound.liquid();
  TANK_IDS.forEach(id => shakeTank(id, true));
}

function initFuelTankEffects() {
  TANK_IDS.forEach(tankId => {
    startBubbleLoop(tankId);

    const tank = document.getElementById(`ftank-${tankId}`);
    if (!tank) return;

    const handleTouch = () => {
      Sound.liquid();
      shakeTank(tankId, true);
    };

    tank.addEventListener('touchstart', handleTouch, { passive: true });
    tank.addEventListener('mousedown',  handleTouch);
  });
}

function initDeviceMotion() {
  if (typeof DeviceMotionEvent === 'undefined') return;

  const attach = () => {
    let prev = { x:0, y:0, z:0 }, lastFired = 0;

    window.addEventListener('devicemotion', e => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const now = Date.now();
      if (now - lastFired < 400) return;

      const delta = Math.abs((a.x||0) - prev.x)
                  + Math.abs((a.y||0) - prev.y)
                  + Math.abs((a.z||0) - prev.z);

      if (delta > 22) {
        lastFired = now;
        shakeAllTanks();
      }
      prev = { x:a.x||0, y:a.y||0, z:a.z||0 };
    });
  };

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    const ask = async () => {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm === 'granted') attach();
      } catch(e) {}
      document.removeEventListener('touchend', ask);
    };
    document.addEventListener('touchend', ask, { once: true });
  } else {
    attach();
  }
}

/* ─── CHART ZOOM INIT ─── */
function initChartZoom() {
  document.querySelectorAll('.chart-zoom-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Charts.zoom(btn.dataset.chart);
    });
  });
}

/* ═══════════════════════════════════════════════
   ROUTER & NAVIGATION
═══════════════════════════════════════════════ */
const PageInits={bank:initBankPage,cash:initCashPage,invoices:initInvoicesPage,finance:initFinancePage,tender:initTenderPage,sleepers:initSleepersPage,vehicle:initVehiclePage,filling:initFillingPage};

async function loadPage(page,force=false) {
  if (State.initialized.has(page)&&!force) return;
  State.initialized.add(page);
  try { await PageInits[page](); } catch(e){ console.error(`Page "${page}":`,e); toast(`Error loading ${page}`,'error'); }
}

function navigate(page) {
  if (!PAGES.includes(page)) page='bank';
  if (!Auth.canAccess(page)) {
    const first=Auth.allowedPages()[0]; if (!first) return; page=first;
  }
  const _mSb=document.getElementById('sidebar');
  const _mOv=document.getElementById('sidebar-overlay');
  if (_mSb?.classList.contains('mobile-open')) { _mSb.classList.remove('mobile-open'); _mOv?.remove(); }
  Sound.unlock(); Sound.nav();
  document.querySelectorAll('.page-section').forEach(s=>{ s.classList.add('hidden'); s.classList.remove('page-active'); });
  const target=document.getElementById(`pg-${page}`);
  if (target){
    target.classList.remove('hidden');
    requestAnimationFrame(()=>{
      target.classList.add('page-active');
      target.querySelectorAll('.kpi-value[data-raw]').forEach(el=>{
        const raw=parseFloat(el.dataset.raw);
        if (!isNaN(raw)&&raw!==0) countUp(el,raw,1100,el.dataset.pfx||'',el.dataset.sfx||'');
      });
    });
  }
  document.querySelectorAll('.nav-item,.bnav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
  const te=document.getElementById('topbar-title');
  if (te) te.textContent=PAGE_TITLES[page]||page;
  history.replaceState(null,'','#'+page);
  State.currentPage=page;
  loadPage(page);
}

async function refreshCurrentPage() {
  const page=State.currentPage;
  State.initialized.delete(page);
  const btn=document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  Sound.refresh();
  toast('Refreshing data…','');
  await Promise.all([loadPage(page,true),loadFreshnessData()]);
  setTimeout(()=>btn?.classList.remove('spinning'),700);
  const now=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const el=document.getElementById('sb-refreshed'); if (el) el.textContent=`Refreshed ${now}`;
  toast('Data refreshed','success');
}

/* ─── SPLASH ─── */
async function runSplash() {
  const circle = document.getElementById('splash-circle');
  const pctEl  = document.getElementById('splash-pct');
  const term   = document.getElementById('splash-terminal');
  const CIRC   = 2 * Math.PI * 52;
  if (circle) { circle.style.strokeDasharray=CIRC; circle.style.strokeDashoffset=CIRC; }

  const steps = [
    [12,  'Initializing System...'],
    [30,  'Analyzing production data...'],
    [52,  'Connecting Operational Nodes...'],
    [75,  'Syncing AI Assistant...'],
    [92,  'Rendering dashboard...'],
    [100, 'System ready.']
  ];

  async function typeMsg(text) {
    if (!term) return;
    term.textContent = '> ';
    for (const ch of text) {
      term.textContent += ch;
      await new Promise(r => setTimeout(r, 22));
    }
  }

  try {
    for (const [pct, msg] of steps) {
      await typeMsg(msg);
      if (circle) circle.style.strokeDashoffset = CIRC * (1 - pct / 100);
      if (pctEl)  pctEl.textContent = pct;
      await new Promise(r => setTimeout(r, 310));
    }
    await new Promise(r => setTimeout(r, 420));
  } finally {
    document.getElementById('splash')?.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 750));
    const s=document.getElementById('splash'); if(s) s.style.display='none';
  }
}

/* ─── CLOCK ─── */
function updateClock() {
  const now=new Date();
  const clk=document.getElementById('topbar-clock');
  if (clk) clk.textContent=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const dt=document.getElementById('topbar-date');
  if (dt) dt.textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}

/* ─── KEYBOARD NAVIGATION ─── */
function initKeyboard() {
  document.addEventListener('keydown',e=>{
    if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
    const idx=PAGES.indexOf(State.currentPage);
    if ((e.key==='ArrowRight'||e.key==='ArrowDown')&&idx<PAGES.length-1) navigate(PAGES[idx+1]);
    else if ((e.key==='ArrowLeft'||e.key==='ArrowUp')&&idx>0) navigate(PAGES[idx-1]);
    else if (e.key==='r'||e.key==='R') refreshCurrentPage();
  });
}

/* ─── TOUCH SWIPE ─── */
function initSwipe() {
  let startX=0, startY=0, swipeTarget=null;
  document.addEventListener('touchstart',e=>{
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    swipeTarget=e.target;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if (swipeTarget?.closest('.tbl-wrap,.chart-box,.charts-row,.filter-bar,input,select,button,#sidebar,#bottom-nav')) return;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if (Math.abs(dx)<90||Math.abs(dy)>Math.abs(dx)*0.5) return;
    const idx=PAGES.indexOf(State.currentPage);
    if (dx<0&&idx<PAGES.length-1) navigate(PAGES[idx+1]);
    else if (dx>0&&idx>0) navigate(PAGES[idx-1]);
  },{passive:true});
}

/* ─── ACCESS CONTROL ─── */
function applyAccessControl() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
    el.style.display=Auth.canAccess(el.dataset.page)?'':'none';
  });
  document.querySelectorAll('.bnav-item[data-page]').forEach(el=>{
    el.style.display=Auth.canAccess(el.dataset.page)?'':'none';
  });
  const userEl=document.getElementById('sb-user-name');
  if (userEl&&Auth.user) userEl.textContent=`👤 ${Auth.user.display}`;
}

/* ─── LOGIN FORM ─── */
function initLoginForm() {
  const btn=document.getElementById('login-btn');
  const userInput=document.getElementById('login-user');
  const passInput=document.getElementById('login-pass');
  const errEl=document.getElementById('login-error');
  const ls=document.getElementById('login-screen');

  async function doLogin() {
    const username=(userInput?.value||'').trim();
    const pass=passInput?.value||'';
    if (errEl) errEl.classList.add('hidden');
    if (!username||!pass) {
      if (errEl){ errEl.textContent='⚠ Please enter your username and password'; errEl.classList.remove('hidden'); }
      return;
    }
    if (Auth.login(username,pass)) {
      Sound.success();
      if (btn){ btn.disabled=true; btn.textContent='Signing in…'; }
      ls?.classList.add('fade-out');
      await new Promise(r=>setTimeout(r,500));
      if (ls){ ls.classList.add('hidden'); ls.classList.remove('fade-out'); }
      if (btn){ btn.disabled=false; btn.textContent='Sign In →'; }
      await startApp();
    } else {
      Sound.warn();
      if (errEl){ errEl.textContent='⚠ Invalid username or password'; errEl.classList.remove('hidden'); }
      if (passInput){ passInput.value=''; passInput.focus(); }
    }
  }

  btn?.addEventListener('click',doLogin);
  passInput?.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
  userInput?.addEventListener('keydown',e=>{ if(e.key==='Enter') passInput?.focus(); });
}

function showLoginScreen() {
  const ls=document.getElementById('login-screen');
  if (ls) ls.classList.remove('hidden');
  const u=document.getElementById('login-user');
  const p=document.getElementById('login-pass');
  if (u) u.value='';
  if (p) p.value='';
  document.getElementById('login-error')?.classList.add('hidden');
  setTimeout(()=>document.getElementById('login-user')?.focus(),150);
}

/* ─── START APP ─── */
let _appInitialized=false;

async function startApp() {
  applyAccessControl();
  document.getElementById('app')?.classList.remove('hidden');

  if (!_appInitialized) {
    _appInitialized=true;

    updateClock(); setInterval(updateClock,1000);

    document.getElementById('menu-btn')?.addEventListener('click',()=>{
      Sound.click();
      const sb=document.getElementById('sidebar');
      if (!sb) return;
      if (window.innerWidth<=768){
        sb.classList.toggle('mobile-open');
        let ov=document.getElementById('sidebar-overlay');
        if (!ov){ ov=document.createElement('div'); ov.id='sidebar-overlay'; document.body.appendChild(ov); ov.addEventListener('click',()=>{ sb.classList.remove('mobile-open'); ov.remove(); }); }
      } else { sb.classList.toggle('sidebar-collapsed'); }
    });

    document.querySelectorAll('.nav-item,.bnav-item').forEach(el=>
      el.addEventListener('click',e=>{ e.preventDefault(); navigate(el.dataset.page); })
    );
    document.getElementById('refresh-btn')?.addEventListener('click',refreshCurrentPage);

    const mo=document.getElementById('modal-overlay');
    document.getElementById('modal-close')?.addEventListener('click',()=>mo?.classList.add('hidden'));
    mo?.addEventListener('click',e=>{ if(e.target===mo) mo.classList.add('hidden'); });

    function doLogout() {
      Sound.click();
      Auth.logout();
      State.initialized.clear();
      State.freshnessData=[];
      Object.values(State.charts).forEach(c=>{ try{c.destroy();}catch(e){} });
      State.charts={};
      document.getElementById('app')?.classList.add('hidden');
      document.querySelectorAll('.page-section').forEach(s=>{
        s.classList.remove('page-active'); s.classList.add('hidden');
      });
      showLoginScreen();
    }
    document.getElementById('logout-btn')?.addEventListener('click', doLogout);
    document.getElementById('mobile-logout-btn')?.addEventListener('click', doLogout);

    initChartZoom();
    initKeyboard();
    initSwipe();
    initFuelTankEffects();
    initDeviceMotion();

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  loadFreshnessData();

  const hash=location.hash.slice(1);
  const allowed=Auth.allowedPages();
  const startPage=(PAGES.includes(hash)&&Auth.canAccess(hash))?hash:(allowed[0]||'bank');
  navigate(startPage);
}

/* ─── INIT ─── */
async function init() {
  Sound.init();
  ['click','touchstart','keydown'].forEach(ev=>
    document.addEventListener(ev,()=>Sound.unlock(),{once:true,passive:true})
  );
  initBgCanvas();
  initLoginForm();
  await runSplash();

  if (Auth.restore()) {
    await startApp();
  } else {
    showLoginScreen();
  }
}

init().catch(err=>{
  console.error('Dashboard init error:',err);
  const st=document.getElementById('splash-terminal');
  if (st) st.textContent='> Load error — check console (F12)';
  const sp=document.getElementById('splash');
  if (sp) sp.style.background='#0a0505';
});

// Redraw sparklines on resize (cards change width on mobile)
let _sparkResizeTimer;
window.addEventListener('resize', ()=>{
  clearTimeout(_sparkResizeTimer);
  _sparkResizeTimer = setTimeout(()=>{
    document.querySelectorAll('.kpi-spark-canvas').forEach(canvas=>{
      const card = canvas.closest('.kpi-card');
      if (!card) return;
      const rgb = getComputedStyle(card).getPropertyValue('--kpi-rgb').trim() || '0,200,255';
      // Re-read data from stored attribute if available, else skip
      const stored = canvas._sparkData;
      if (stored) drawSparkline(canvas, stored, rgb);
    });
  }, 200);
});
