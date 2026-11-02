const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const num=v=>v==null||v===''?null:Number(v);
const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);
const pct=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'—':(Number(v)*100).toFixed(d)+'%';
const pctRaw=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d)+'%';
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const yes=v=>String(v).toLowerCase()==='true';
const REMOTE_FORWARD='https://raw.githubusercontent.com/galbbb2772/box-dashboard/main/data/robust_forward_live.json';
const colors=['#8cb8ff','#56d6a4','#f3c76b','#b59cff','#ff8f70','#62d8e8','#ff7d89','#d0d6df','#9ad276','#e6a7d5'];
const baseLayout={paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{color:'#cad5e7'},margin:{l:64,r:24,t:34,b:56},hovermode:'x unified',legend:{orientation:'h',y:1.12,x:0},dragmode:'pan',xaxis:{gridcolor:'#182235'},yaxis:{gridcolor:'#182235'}};
const config={responsive:true,displaylogo:false,displayModeBar:false,scrollZoom:false,doubleClick:'reset'};
const DATA='data/v2/';

function parseCSV(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){
      if(q&&n==='"'){cell+='"';i++;}
      else q=!q;
    }else if(c===','&&!q){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);cell='';
      if(row.some(x=>x!==''))rows.push(row);
      row=[];
    }else cell+=c;
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  if(!rows.length)return[];
  const head=rows[0].map(x=>x.trim());
  return rows.slice(1).map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));
}
async function fetchText(url){const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(url+' '+r.status);return r.text()}
async function fetchCSV(url){return parseCSV(await fetchText(url))}
async function fetchJSON(url){const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(url+' '+r.status);return r.json()}
function table(rows,cols){return '<table><thead><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map((c,i)=>'<td class="'+(i===0?'left':'')+'">'+c[1](r)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
function metricCards(items){return items.map(x=>'<div class="metric"><span class="small">'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('')}
function detail(items){return items.map(x=>'<div class="detail"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('')}
function nearestIndex(dates,date){const t=Date.parse(date);let best=0,dist=Infinity;dates.forEach((d,i)=>{const z=Math.abs(Date.parse(d)-t);if(z<dist){dist=z;best=i}});return best}
function clampWindow(dates,a,b,minPts=60){let lo=nearestIndex(dates,String(a).slice(0,10)),hi=nearestIndex(dates,String(b).slice(0,10));if(lo>hi)[lo,hi]=[hi,lo];lo=Math.max(0,lo);hi=Math.min(dates.length-1,hi);const need=Math.min(minPts,dates.length);if(hi-lo+1<need){const center=Math.round((lo+hi)/2);lo=Math.max(0,center-Math.floor((need-1)/2));hi=Math.min(dates.length-1,lo+need-1);lo=Math.max(0,hi-need+1)}return[dates[lo],dates[hi]]}
function presetWindow(dates,key){const end=Date.parse(dates.at(-1));if(key==='ALL')return[dates[0],dates.at(-1)];const days={'1M':30,'3M':90,'6M':183,'12M':365,'1Y':365,'3Y':1095,'5Y':1826}[key]||365;const start=new Date(end-days*86400000).toISOString().slice(0,10);return[dates[Math.max(0,nearestIndex(dates,start))],dates.at(-1)]}
function bindTabs(){ $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');setTimeout(()=>window.dispatchEvent(new Event('resize')),80)})}

let MASTER=[],MASTER_BY_ID=new Map(),PHASE={},DDS={},EXEC=new Map(),NAV_CACHE=new Map(),explorerRange=null,explorerBusy=false,F=null,forwardRange=null,forwardBusy=false;

function navFileFor(id){
  if(id.startsWith('BF_'))return'BOX_FROZEN.csv';
  if(id.startsWith('BR_'))return'BOX_RISK.csv';
  if(id.startsWith('CF_'))return'CAPITAL_FROZEN.csv';
  if(id.startsWith('RF_'))return'RISK_FROZEN.csv';
  if(id.startsWith('BRF_')){
    if(id.includes('_RISK-FIXED3_'))return'TRIPLE_FIXED3.csv';
    if(id.includes('_RISK-SAME-CLOSE_'))return'TRIPLE_SAME_CLOSE.csv';
    if(id.includes('_RISK-NEXT-OPEN_'))return'TRIPLE_NEXT_OPEN.csv';
    if(id.includes('_RISK-T6_'))return'TRIPLE_T6.csv';
  }
  throw new Error('No NAV family for '+id);
}
async function loadNavSeries(id){
  const file=navFileFor(id);
  if(!NAV_CACHE.has(file)){
    const rows=await fetchCSV(DATA+'daily_nav/'+file);
    NAV_CACHE.set(file,rows);
  }
  const rows=NAV_CACHE.get(file);
  return {dates:rows.map(r=>r.date),nav:rows.map(r=>num(r[id]))};
}
function filteredStructures(){
  const type=$('#structureType').value,q=$('#structureSearch').value.trim().toLowerCase();
  return MASTER.filter(r=>(type==='ALL'||r.type===type)&&(!q||[r.structure_id,r.type,r.components,r.base_weights].join(' ').toLowerCase().includes(q)));
}
function refreshStructureOptions(keep=true){
  const sel=$('#structureSelect'),old=keep?sel.value:'';const rows=filteredStructures();
  sel.innerHTML=rows.map(r=>'<option value="'+esc(r.structure_id)+'">'+esc(r.structure_id)+' · '+esc(r.type)+'</option>').join('');
  if(old&&rows.some(r=>r.structure_id===old))sel.value=old;
  if(!sel.value&&rows.length)sel.value=rows[0].structure_id;
  if(sel.value)renderExplorer(sel.value);
}
function bindExplorer(){
  const types=[...new Set(MASTER.map(r=>r.type))].sort();
  $('#structureType').insertAdjacentHTML('beforeend',types.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join(''));
  $('#structureType').onchange=()=>refreshStructureOptions(false);$('#structureSearch').oninput=()=>refreshStructureOptions(true);$('#structureSelect').onchange=e=>renderExplorer(e.target.value);
  $('#explorerPresets').onclick=e=>{const b=e.target.closest('button[data-range]');if(!b||!explorerRange)return;$$('#explorerPresets button').forEach(x=>x.classList.toggle('active',x===b));const id=$('#structureSelect').value;loadNavSeries(id).then(s=>renderExplorer(id,presetWindow(s.dates,b.dataset.range)))};
  $('#explorerApply').onclick=()=>renderExplorer($('#structureSelect').value,[$('#explorerStart').value,$('#explorerEnd').value]);
  $('#explorerReset').onclick=async()=>{const id=$('#structureSelect').value,s=await loadNavSeries(id);renderExplorer(id,[s.dates[0],s.dates.at(-1)])};
  refreshStructureOptions(false);
}
async function renderExplorer(id,range=null){
  const m=MASTER_BY_ID.get(id);if(!m)return;
  const s=await loadNavSeries(id),safe=clampWindow(s.dates,range?.[0]||s.dates[0],range?.[1]||s.dates.at(-1),60);explorerRange=safe;
  $('#explorerStart').min=s.dates[0];$('#explorerStart').max=s.dates.at(-1);$('#explorerEnd').min=s.dates[0];$('#explorerEnd').max=s.dates.at(-1);$('#explorerStart').value=safe[0];$('#explorerEnd').value=safe[1];
  $('#explorerTitle').textContent=id+' · '+m.type+' · 历史净值';
  const trace={x:s.dates,y:s.nav,name:id,type:'scatter',mode:'lines',line:{width:2.3,color:colors[0]},hovertemplate:'%{x}<br>'+esc(id)+'<br>NAV %{y:.4f}x<extra></extra>'};
  await Plotly.react('explorerChart',[trace],{...baseLayout,xaxis:{...baseLayout.xaxis,range:safe,rangeslider:{visible:true,thickness:.08},title:'Market date'},yaxis:{...baseLayout.yaxis,title:'NAV multiple'}},config);
  const el=$('#explorerChart');if(!el.__bound){el.on('plotly_relayout',ev=>{if(explorerBusy)return;const a=ev['xaxis.range[0]'],b=ev['xaxis.range[1]'];if(a!=null&&b!=null){const next=clampWindow(s.dates,a,b,60);explorerBusy=true;Plotly.relayout(el,{'xaxis.range':next}).finally(()=>explorerBusy=false);explorerRange=next;$('#explorerStart').value=next[0];$('#explorerEnd').value=next[1]}});el.__bound=true}
  $('#explorerCards').innerHTML=metricCards([
    ['累计收益',pct(num(m.total_return))],['CAGR',pct(num(m.cagr))],['MaxDD',pct(num(m.mdd))],['Sharpe',fmt(m.sharpe,3)],['稳健性分数',fmt(m.stability_score_v2,1)]
  ]);
  $('#structureRisk').innerHTML=detail([
    ['5%回撤曾发生',yes(m.dd5_ever)?'是':'否'],['5%回撤次数',m.dd5_episode_count||'0'],['5%中位触发滞后',(m.dd5_lag_median_sessions||'—')+' sessions'],['5%中位恢复',(m.dd5_recovery_median_sessions||'—')+' sessions'],['5%水下占比',pct(num(m.dd5_occupancy))],
    ['10%回撤曾发生',yes(m.dd10_ever)?'是':'否'],['10%回撤次数',m.dd10_episode_count||'0'],['10%中位触发滞后',(m.dd10_lag_median_sessions||'—')+' sessions'],['10%中位恢复',(m.dd10_recovery_median_sessions||'—')+' sessions'],['10%水下占比',pct(num(m.dd10_occupancy))]
  ]);
  const e=EXEC.get(id)||{};
  $('#structureExecution').innerHTML=detail([
    ['15bps CAGR',pct(num(m.cagr_15bps_2022_2026Q1))],['25bps CAGR',pct(num(m.cagr_25bps_2022_2026Q1))],['Strict / Phase',m.strict_1x_status_2022_2026Q1||'—'],['Phase证据',m.phase_cash_evidence||'—'],['平均资金占用',e.avgUtil==null?'待证据':pct(e.avgUtil)],['最大资金占用',e.maxUtil==null?'待证据':pct(e.maxUtil)],['冲突日',e.conflictDays==null?'待证据':e.conflictDays],['同票同日冲突',e.sameSymbol==null?'待证据':e.sameSymbol],['峰值融资/NAV',e.peakBorrow==null?'待证据':pct(e.peakBorrow)],['数据质量',m.source_quality||'—']
  ]);
}

async function buildExecutionMap(){
  const legacy=await fetchCSV(DATA+'execution/MASTER_RESULTS_110.csv');
  const newer=await fetchCSV(DATA+'execution/NEW_VARIANT_CONFLICT_EXACT_34.csv');
  const legacyBy=new Map(legacy.map(r=>[r.combo_id,r]));
  const newBy=new Map(newer.map(r=>[r.structure_id,r]));
  for(const m of MASTER){
    const old=m.legacy_combo_id?legacyBy.get(m.legacy_combo_id):null,nw=newBy.get(m.structure_id);
    EXEC.set(m.structure_id,{
      avgUtil:old?num(old.avg_capital_utilization_2022_2026Q1):null,
      maxUtil:old?num(old.max_capital_utilization_2022_2026Q1):null,
      peakBorrow:old?num(old.strict_peak_borrow_ratio_2022_2026Q1):null,
      conflictDays:nw?num(nw.conflict_days):(old?num(old.conflict_days_2022_2026Q1):null),
      conflictOrders:nw?num(nw.conflict_day_orders):null,
      sameSymbol:nw?num(nw.same_security_same_day_pairs):(old?num(old.same_symbol_same_day_pairs_2022_2026Q1):null),
      source:nw?'V2 exact conflict ledger':(old?'Legacy 110 exact execution ledger':'')
    });
  }
}
function renderRisk(){
  const base5=MASTER.filter(r=>yes(r.dd5_ever)).length,base10=MASTER.filter(r=>yes(r.dd10_ever)).length;
  const cost15=MASTER.filter(r=>num(r.cagr_15bps_2022_2026Q1)!=null).length,cost25=MASTER.filter(r=>num(r.cagr_25bps_2022_2026Q1)!=null).length;
  const exactExec=MASTER.filter(r=>{const e=EXEC.get(r.structure_id);return e&&e.conflictDays!=null}).length;
  const pass=MASTER.filter(r=>r.strict_1x_status_2022_2026Q1==='PASS_1X_CASH').length,fin=MASTER.filter(r=>r.strict_1x_status_2022_2026Q1==='REQUIRES_FINANCING').length,unt=304-pass-fin;
  $('#riskCards').innerHTML=metricCards([
    ['基础结构','304'],['权重场景','7,696'],['5%回撤(权重)',DDS.dd5_ever+'/'+DDS.total_scenarios],['10%回撤(权重)',DDS.dd10_ever+'/'+DDS.total_scenarios],['冲突日精确覆盖',exactExec+'/304']
  ]);
  $('#drawdownSummary').innerHTML=detail([
    ['304基础结构：5%发生',base5+'/304 · '+pctRaw(base5/304*100,1)],['304基础结构：10%发生',base10+'/304 · '+pctRaw(base10/304*100,1)],['7,696权重：5%发生',DDS.dd5_ever+'/'+DDS.total_scenarios+' · '+pctRaw(DDS.dd5_ever/DDS.total_scenarios*100,1)],['7,696权重：10%发生',DDS.dd10_ever+'/'+DDS.total_scenarios+' · '+pctRaw(DDS.dd10_ever/DDS.total_scenarios*100,1)],['权重场景未破10%',DDS.no_dd10+'/'+DDS.total_scenarios+' · '+pctRaw(DDS.no_dd10/DDS.total_scenarios*100,1)]
  ]);
  $('#coverageSummary').innerHTML=detail([
    ['Base Strict PASS',pass+'/304'],['Base 需要融资',fin+'/304'],['Base 待Phase证据',unt+'/304'],['Weight Strict PASS',PHASE.counts?.PASS_1X_CASH??'—'],['Weight 需要融资',PHASE.counts?.REQUIRES_FINANCING??'—'],['Weight 待Phase',PHASE.counts?.NOT_TESTED_PHASE_CASH??'—'],['15bps Base成本覆盖',cost15+'/304'],['25bps Base成本覆盖',cost25+'/304'],['冲突日精确覆盖',exactExec+'/304']
  ]);
  const rows=MASTER.map(m=>{const e=EXEC.get(m.structure_id)||{};return{...m,...e}});
  $('#executionTable').innerHTML=table(rows,[
    ['结构',r=>esc(r.structure_id)],['Strict/Phase',r=>esc(r.strict_1x_status_2022_2026Q1||'—')],['平均资金占用',r=>r.avgUtil==null?'待证据':pct(r.avgUtil)],['最大资金占用',r=>r.maxUtil==null?'待证据':pct(r.maxUtil)],['峰值融资/NAV',r=>r.peakBorrow==null?'待证据':pct(r.peakBorrow)],['冲突日',r=>r.conflictDays==null?'待证据':r.conflictDays],['同票同日',r=>r.sameSymbol==null?'待证据':r.sameSymbol],['15bps CAGR',r=>pct(num(r.cagr_15bps_2022_2026Q1))],['25bps CAGR',r=>pct(num(r.cagr_25bps_2022_2026Q1))],['证据',r=>esc(r.source||r.phase_cash_evidence||'—')]
  ]);
}

const RANKINGS={
 historical:{label:'历史收益 Top10',file:'TOP10_HISTORICAL_RETURN.csv',desc:'按完整历史累计收益排序。',metric:'total_return',metricLabel:'累计收益',pct:true},
 stability:{label:'结构稳健性 Top10',file:'TOP10_STABILITY.csv',desc:'按 V2 稳健性分数排序。',metric:'stability_score_v2',metricLabel:'稳健性分数',pct:false},
 weightRobust:{label:'权重稳健性 Top10',file:'WEIGHT_TOP10_ROBUSTNESS.csv',desc:'衡量不同权重下是否保持接近最优表现。',metric:'weight_robustness_score',metricLabel:'权重稳健性',pct:false},
 financing:{label:'融资收益 Top10',file:'TOP10_FINANCING_RETURN.csv',desc:'允许融资/杠杆路径下的历史收益榜。',metric:'total_return',metricLabel:'累计收益',pct:true},
 cagr:{label:'CAGR Top10',file:'TOP10_CAGR.csv',desc:'按完整历史 CAGR 排序。',metric:'cagr',metricLabel:'CAGR',pct:true},
 sharpe:{label:'Sharpe Top10',file:'TOP10_SHARPE.csv',desc:'按历史 Sharpe 排序。',metric:'sharpe',metricLabel:'Sharpe',pct:false},
 lowdd:{label:'最小回撤 Top10',file:'TOP10_LOW_DRAWDOWN.csv',desc:'按最大回撤绝对值最小排序。',metric:'mdd',metricLabel:'MaxDD',pct:true},
 cost15:{label:'15bps 成本 Top10',file:'WEIGHT_TOP10_15BPS_CAGR.csv',desc:'额外 +15bps/side 成本压力后的 CAGR。',metric:'cagr_15bps',metricLabel:'15bps CAGR',pct:true},
 cost25:{label:'25bps 成本 Top10',file:'WEIGHT_TOP10_25BPS_CAGR.csv',desc:'额外 +25bps/side 成本压力后的 CAGR。',metric:'cagr_25bps',metricLabel:'25bps CAGR',pct:true}
};
let rankCache=new Map();
function bindRankings(){
  $('#top10Select').innerHTML=Object.entries(RANKINGS).map(([k,v])=>'<option value="'+k+'">'+esc(v.label)+'</option>').join('');
  $('#top10Select').onchange=e=>renderRanking(e.target.value);renderRanking('historical');
}
async function renderRanking(key){
  const cfg=RANKINGS[key];$('#top10Desc').textContent=cfg.desc;
  if(!rankCache.has(key))rankCache.set(key,await fetchCSV(DATA+'rankings/'+cfg.file));
  const raw=rankCache.get(key).slice(0,10),rows=raw.map((r,i)=>({
    rank:r.rank||i+1,id:r.structure_id||r.id||'—',weights:r.weights||r.base_weights||r.best_weights||'—',type:r.type||'—',total:num(r.total_return),cagr:num(r.cagr??r.best_cagr),mdd:num(r.mdd??r.worst_weight_mdd),sharpe:num(r.sharpe??r.median_sharpe),stability:num(r.stability_score_v2??r.weight_robustness_score),strict:r.strict_1x_status_2022_2026Q1||r.phase_cash_status||'—',cost15:num(r.cagr_15bps),cost25:num(r.cagr_25bps),primary:num(r[cfg.metric])
  }));
  $('#top10Cards').innerHTML=metricCards([['榜单',cfg.label],['第1名',rows[0]?.id||'—'],['第1名指标',cfg.pct?pct(rows[0]?.primary):fmt(rows[0]?.primary,3)],['第1名 CAGR',pct(rows[0]?.cagr)],['第1名 MaxDD',pct(rows[0]?.mdd)]]);
  const x=rows.map(r=>r.id).reverse(),y=rows.map(r=>r.primary).reverse();
  await Plotly.react('top10Chart',[{x:y,y:x,type:'bar',orientation:'h',marker:{color:colors[0]},hovertemplate:'%{y}<br>'+esc(cfg.metricLabel)+' %{x:.4f}<extra></extra>'}],{...baseLayout,height:420,margin:{l:260,r:30,t:28,b:50},xaxis:{...baseLayout.xaxis,title:cfg.metricLabel},yaxis:{gridcolor:'rgba(0,0,0,0)'}},{...config,staticPlot:false});
  $('#top10Table').innerHTML=table(rows,[['#',r=>r.rank],['结构',r=>esc(r.id)],['权重',r=>esc(r.weights)],['类型',r=>esc(r.type)],['累计收益',r=>pct(r.total)],['CAGR',r=>pct(r.cagr)],['MaxDD',r=>pct(r.mdd)],['Sharpe',r=>fmt(r.sharpe,3)],['稳健性',r=>fmt(r.stability,2)],['15bps',r=>pct(r.cost15)],['25bps',r=>pct(r.cost25)],['Strict/Phase',r=>esc(r.strict)]])
}

async function loadForward(){const local=await fetchJSON('data/forward-oos-snapshot.json');let remote=null;try{remote=await fetch(REMOTE_FORWARD+'?ts='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null)}catch(_){}if(remote?.lanes?.length&&String(remote.last_processed_market_date||'')>=String(local.last_processed_market_date||''))return remote;return local}
function forwardDates(){return[...new Set(F.lanes.flatMap(l=>l.series.map(r=>r.date)))].sort()}
async function renderForward(range=forwardRange){const dates=forwardDates(),minPts=Math.min(Number(F.min_visible_points||5),dates.length),safe=clampWindow(dates,range[0],range[1],minPts);forwardRange=safe;$('#forwardStart').value=safe[0];$('#forwardEnd').value=safe[1];const eq=F.lanes.map((l,i)=>({x:l.series.map(r=>r.date),y:l.series.map(r=>Number(r.equity)),name:l.id+' · '+l.name,type:'scatter',mode:'lines+markers',line:{width:2.2,color:colors[i%colors.length]},marker:{size:5}}));const dd=F.lanes.map((l,i)=>({x:l.series.map(r=>r.date),y:l.series.map(r=>Number(r.drawdown_pct)),name:l.id,type:'scatter',mode:'lines+markers',line:{width:2.1,color:colors[i%colors.length]},marker:{size:5}}));const xl={...baseLayout.xaxis,range:safe,rangeslider:{visible:true,thickness:.1},title:'U.S. market date'};await Plotly.react('forwardEquity',eq,{...baseLayout,xaxis:xl,yaxis:{...baseLayout.yaxis,title:'Normalized equity'}},config);await Plotly.react('forwardDrawdown',dd,{...baseLayout,xaxis:{...xl,rangeslider:{visible:false}},yaxis:{...baseLayout.yaxis,title:'Drawdown %',ticksuffix:'%'}},config);for(const id of ['forwardEquity','forwardDrawdown']){const el=$('#'+id);if(!el.__bound){el.on('plotly_relayout',ev=>{if(forwardBusy)return;const a=ev['xaxis.range[0]'],b=ev['xaxis.range[1]'];if(a!=null&&b!=null){const next=clampWindow(dates,a,b,minPts);forwardRange=next;forwardBusy=true;Promise.all(['forwardEquity','forwardDrawdown'].map(x=>Plotly.relayout(x,{'xaxis.range':next}))).finally(()=>forwardBusy=false);$('#forwardStart').value=next[0];$('#forwardEnd').value=next[1]}});el.__bound=true}}const latest=F.lanes.map(l=>{const s=l.series,last=s.at(-1)||{};return{id:l.id,name:l.name,role:l.role,status:l.status,last,mdd:Math.min(...s.map(r=>Number(r.drawdown_pct)||0))}});$('#forwardCards').innerHTML=metricCards([['Last processed',F.last_processed_market_date||'—'],['Daily rows',F.official_daily_rows??'—'],['Trade events',F.official_trade_events??'—'],['Signal boundary',F.official_signal_boundary],['Earliest entry',F.earliest_official_entry]]);$('#forwardTable').innerHTML=table(latest,[['Lane',r=>esc(r.id)],['Role',r=>esc(r.role||'—')],['Equity',r=>fmt(r.last.equity,5)+'x'],['Return',r=>pctRaw((Number(r.last.equity)-1)*100,3)],['MDD',r=>pctRaw(r.mdd,3)],['Gross',r=>pctRaw(r.last.gross_exposure_pct,2)],['Open',r=>r.last.open_positions],['Date',r=>esc(r.last.date)]]);$('#forwardMeta').textContent='Signal boundary '+F.official_signal_boundary+' · last processed '+(F.last_processed_market_date||'—');const trades=F.trades||[];$('#tradeTable').innerHTML=trades.length?table(trades,[['Date',r=>esc(r.event_date)],['Lane',r=>esc(r.lane_id)],['Event',r=>esc(r.event_type)],['Symbol',r=>esc(r.symbol)],['Mechanism',r=>esc(r.mechanism)],['Entry',r=>esc(r.entry_price||'—')],['Risk %',r=>esc(r.risk_budget_pct||'—')],['Alloc %',r=>esc(r.capital_allocated_pct||'—')]]):'<div class="muted">当前 feed 未包含交易事件明细。</div>'}
function bindForward(){const dates=forwardDates();$('#forwardStart').min=dates[0];$('#forwardStart').max=dates.at(-1);$('#forwardEnd').min=dates[0];$('#forwardEnd').max=dates.at(-1);$('#forwardPresets').onclick=e=>{const b=e.target.closest('button[data-range]');if(!b)return;$$('#forwardPresets button').forEach(x=>x.classList.toggle('active',x===b));renderForward(presetWindow(dates,b.dataset.range))};$('#forwardApply').onclick=()=>renderForward([$('#forwardStart').value,$('#forwardEnd').value]);$('#forwardReset').onclick=()=>renderForward([dates[0],dates.at(-1)]);renderForward([dates[0],dates.at(-1)])}

function renderRegistry(filter=''){const q=filter.trim().toLowerCase(),rows=MASTER.filter(r=>!q||[r.structure_id,r.type,r.components,r.base_weights,r.strict_1x_status_2022_2026Q1,r.phase_cash_evidence].join(' ').toLowerCase().includes(q));$('#registryTable').innerHTML=table(rows,[['结构',r=>esc(r.structure_id)],['类型',r=>esc(r.type)],['权重',r=>esc(r.base_weights)],['累计收益',r=>pct(num(r.total_return))],['CAGR',r=>pct(num(r.cagr))],['MaxDD',r=>pct(num(r.mdd))],['Sharpe',r=>fmt(r.sharpe,3)],['稳健性',r=>fmt(r.stability_score_v2,1)],['5%次数',r=>r.dd5_episode_count],['10%次数',r=>r.dd10_episode_count],['15bps CAGR',r=>pct(num(r.cagr_15bps_2022_2026Q1))],['25bps CAGR',r=>pct(num(r.cagr_25bps_2022_2026Q1))],['Strict/Phase',r=>esc(r.strict_1x_status_2022_2026Q1||'—')]])}
function renderRegistryCards(){const pass=MASTER.filter(r=>r.strict_1x_status_2022_2026Q1==='PASS_1X_CASH').length,fin=MASTER.filter(r=>r.strict_1x_status_2022_2026Q1==='REQUIRES_FINANCING').length;$('#registryCards').innerHTML=metricCards([['基础结构','304'],['历史起点',MASTER[0]?.common_start||'—'],['历史终点',MASTER[0]?.common_end||'—'],['Strict PASS',pass],['需要融资',fin]])}

(async()=>{
  bindTabs();
  [MASTER,PHASE,DDS]=await Promise.all([fetchCSV(DATA+'MASTER_RESULTS_304_WITH_STABILITY.csv'),fetchJSON(DATA+'PHASE_STATUS_SUMMARY.json'),fetchJSON(DATA+'DRAWDOWN_SUMMARY.json')]);
  MASTER_BY_ID=new Map(MASTER.map(r=>[r.structure_id,r]));
  await buildExecutionMap();
  F=await loadForward();
  $('#asof').textContent='HIST '+(MASTER[0]?.common_end||'—')+' · FWD '+(F.last_processed_market_date||'—');
  bindExplorer();renderRisk();bindRankings();bindForward();renderRegistryCards();renderRegistry();$('#registrySearch').oninput=e=>renderRegistry(e.target.value);
})().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div class="wrap bad">Dashboard load error: '+esc(err.message||err)+'</div>')});