const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toFixed(d);
const pct=(v,d=2)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toFixed(d)+"%";
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const REMOTE_FORWARD="https://raw.githubusercontent.com/galbbb2772/box-dashboard/main/data/robust_forward_live.json";
const colors=["#8cb8ff","#56d6a4","#f3c76b","#b59cff","#ff8f70","#62d8e8","#ff7d89","#d0d6df","#9ad276","#e6a7d5"];
const baseLayout={paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",font:{color:"#cad5e7"},margin:{l:64,r:24,t:34,b:56},hovermode:"x unified",legend:{orientation:"h",y:1.12,x:0},dragmode:"pan",xaxis:{gridcolor:"#182235"},yaxis:{gridcolor:"#182235"}};
const config={responsive:true,displaylogo:false,displayModeBar:false,scrollZoom:false,doubleClick:"reset"};

function table(rows,cols){return "<table><thead><tr>"+cols.map(c=>"<th>"+c[0]+"</th>").join("")+"</tr></thead><tbody>"+rows.map(r=>"<tr>"+cols.map((c,i)=>"<td class='"+(i===0?"left":"")+"'>"+c[1](r)+"</td>").join("")+"</tr>").join("")+"</tbody></table>"}
function nearestIndex(dates,date){const t=Date.parse(date);let best=0,dist=Infinity;dates.forEach((d,i)=>{const z=Math.abs(Date.parse(d)-t);if(z<dist){dist=z;best=i}});return best}
function clampWindow(dates,a,b,minPts){
 let lo=nearestIndex(dates,String(a).slice(0,10)), hi=nearestIndex(dates,String(b).slice(0,10));
 if(lo>hi)[lo,hi]=[hi,lo]; lo=Math.max(0,lo);hi=Math.min(dates.length-1,hi);
 const need=Math.min(minPts,dates.length);
 if(hi-lo+1<need){const center=Math.round((lo+hi)/2);lo=Math.max(0,center-Math.floor((need-1)/2));hi=Math.min(dates.length-1,lo+need-1);lo=Math.max(0,hi-need+1)}
 return [dates[lo],dates[hi]]
}
function presetWindow(dates,key){const end=Date.parse(dates.at(-1));if(key==="ALL")return[dates[0],dates.at(-1)];const days={"1M":30,"3M":90,"6M":183,"12M":365,"1Y":365,"3Y":1095,"5Y":1826}[key]||365;const start=new Date(end-days*86400000).toISOString().slice(0,10);return[dates[Math.max(0,nearestIndex(dates,start))],dates.at(-1)]}
function bindTabs(){ $$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));$$(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#"+b.dataset.tab).classList.add("active");setTimeout(()=>window.dispatchEvent(new Event("resize")),80)})}

let H,F,historyRange,forwardRange,historyBusy=false,forwardBusy=false,currentCategory="historical_return";
function historyRows(){return H.categories[currentCategory].keys.map(k=>H.series[k].meta)}
async function renderHistory(range=historyRange){
 const cat=H.categories[currentCategory], rows=historyRows(), traces=cat.keys.map((k,i)=>{const s=H.series[k];return{x:H.dates,y:s.nav,name:(i+1)+". "+s.meta.id+(s.meta.weights?" @ "+s.meta.weights:""),type:"scatter",mode:"lines",line:{width:2,color:colors[i]},hovertemplate:"%{x}<br>%{fullData.name}<br>NAV %{y:.3f}x<extra></extra>"}});
 const safe=clampWindow(H.dates,range[0],range[1],H.minVisibleSessions);historyRange=safe;
 $("#historyStart").value=safe[0];$("#historyEnd").value=safe[1];
 $("#historyTitle").textContent=cat.label+" · 历史净值";
 await Plotly.react("historyChart",traces,{...baseLayout,xaxis:{...baseLayout.xaxis,range:safe,rangeslider:{visible:true,thickness:.08},title:"Market date"},yaxis:{...baseLayout.yaxis,title:"NAV multiple",rangemode:"tozero"}},config);
 const el=$("#historyChart");if(!el.__bound){el.on("plotly_relayout",ev=>{if(historyBusy)return;const a=ev["xaxis.range[0]"],b=ev["xaxis.range[1]"];if(a!=null&&b!=null){const next=clampWindow(H.dates,a,b,H.minVisibleSessions);historyBusy=true;Plotly.relayout(el,{"xaxis.range":next}).finally(()=>historyBusy=false);historyRange=next;$("#historyStart").value=next[0];$("#historyEnd").value=next[1]}});el.__bound=true}
 $("#historyCards").innerHTML=[["榜单",cat.label],["第1名",rows[0].id],["第1名累计收益",pct(rows[0].totalReturnPct)],["第1名 CAGR",pct(rows[0].cagrPct)],["第1名 MaxDD",pct(rows[0].mddPct)]].map(x=>"<div class='metric'><span class='small'>"+esc(x[0])+"</span><b>"+esc(x[1])+"</b></div>").join("");
 $("#historyTable").innerHTML=table(rows.map((r,i)=>({...r,rank:i+1})),[
 ["# ",r=>r.rank],["结构",r=>esc(r.id)],["权重",r=>esc(r.weights)],["累计收益",r=>pct(r.totalReturnPct)],["CAGR",r=>pct(r.cagrPct)],["MaxDD",r=>pct(r.mddPct)],["Sharpe",r=>fmt(r.sharpe,3)],["Calmar",r=>fmt(r.calmar,3)],["Strict",r=>esc(r.strictStatus)]
 ]);
}
function setHistoryCategory(id){currentCategory=id;$("#rankingDesc").textContent=H.categories[id].description;renderHistory([H.dates[0],H.dates.at(-1)]);$$('#historyPresets button').forEach(b=>b.classList.toggle("active",b.dataset.range==="ALL"))}
function bindHistory(){
 $("#rankingSelect").innerHTML=Object.values(H.categories).map(c=>"<option value='"+c.id+"'>"+esc(c.label)+"</option>").join("");$("#rankingSelect").onchange=e=>setHistoryCategory(e.target.value);
 $("#historyStart").min=H.dates[0];$("#historyStart").max=H.dates.at(-1);$("#historyEnd").min=H.dates[0];$("#historyEnd").max=H.dates.at(-1);
 $("#historyPresets").onclick=e=>{const b=e.target.closest("button[data-range]");if(!b)return;const r=presetWindow(H.dates,b.dataset.range);$$('#historyPresets button').forEach(x=>x.classList.toggle("active",x===b));renderHistory(r)};
 $("#historyApply").onclick=()=>renderHistory([$("#historyStart").value,$("#historyEnd").value]);$("#historyReset").onclick=()=>renderHistory([H.dates[0],H.dates.at(-1)]);
 $("#historyCaveat").innerHTML=H.caveats.map(x=>"• "+esc(x)).join("<br>");
 setHistoryCategory(currentCategory);
}

async function loadForward(){
 const local=await fetch("data/forward-oos-snapshot.json?ts="+Date.now()).then(r=>r.json());
 let remote=null;try{remote=await fetch(REMOTE_FORWARD+"?ts="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():null)}catch(_){}
 if(remote?.lanes?.length && String(remote.last_processed_market_date||"")>=String(local.last_processed_market_date||""))return remote;
 return local;
}
function forwardDates(){return[...new Set(F.lanes.flatMap(l=>l.series.map(r=>r.date)))].sort()}
async function renderForward(range=forwardRange){
 const dates=forwardDates(),minPts=Math.min(Number(F.min_visible_points||5),dates.length),safe=clampWindow(dates,range[0],range[1],minPts);forwardRange=safe;
 $("#forwardStart").value=safe[0];$("#forwardEnd").value=safe[1];
 const eq=F.lanes.map((l,i)=>({x:l.series.map(r=>r.date),y:l.series.map(r=>Number(r.equity)),name:l.id+" · "+l.name,type:"scatter",mode:"lines+markers",line:{width:2.2,color:colors[i]},marker:{size:5},hovertemplate:"%{x}<br>%{fullData.name}<br>Equity %{y:.5f}<extra></extra>"}));
 const dd=F.lanes.map((l,i)=>({x:l.series.map(r=>r.date),y:l.series.map(r=>Number(r.drawdown_pct)),name:l.id,type:"scatter",mode:"lines+markers",line:{width:2.1,color:colors[i]},marker:{size:5},hovertemplate:"%{x}<br>%{fullData.name}<br>DD %{y:.3f}%<extra></extra>"}));
 const xl={...baseLayout.xaxis,range:safe,rangeslider:{visible:true,thickness:.1},title:"U.S. market date"};
 await Plotly.react("forwardEquity",eq,{...baseLayout,xaxis:xl,yaxis:{...baseLayout.yaxis,title:"Normalized equity"}},config);
 await Plotly.react("forwardDrawdown",dd,{...baseLayout,xaxis:{...xl,rangeslider:{visible:false}},yaxis:{...baseLayout.yaxis,title:"Drawdown %",ticksuffix:"%"}},config);
 for(const id of ["forwardEquity","forwardDrawdown"]){const el=$("#"+id);if(!el.__bound){el.on("plotly_relayout",ev=>{if(forwardBusy)return;const a=ev["xaxis.range[0]"],b=ev["xaxis.range[1]"];if(a!=null&&b!=null){const next=clampWindow(dates,a,b,minPts);forwardRange=next;forwardBusy=true;Promise.all(["forwardEquity","forwardDrawdown"].map(x=>Plotly.relayout(x,{"xaxis.range":next}))).finally(()=>forwardBusy=false);$("#forwardStart").value=next[0];$("#forwardEnd").value=next[1]}});el.__bound=true}}
 const latest=F.lanes.map(l=>{const s=l.series,last=s.at(-1)||{};return{id:l.id,name:l.name,role:l.role,status:l.status,last,mdd:Math.min(...s.map(r=>Number(r.drawdown_pct)||0))}});
 $("#forwardCards").innerHTML=[["Last processed",F.last_processed_market_date||"—"],["Daily rows",F.official_daily_rows??"—"],["Trade events",F.official_trade_events??"—"],["Signal boundary",F.official_signal_boundary],["Earliest entry",F.earliest_official_entry]].map(x=>"<div class='metric'><span class='small'>"+x[0]+"</span><b>"+esc(x[1])+"</b></div>").join("");
 $("#forwardTable").innerHTML=table(latest,[["Lane",r=>esc(r.id)],["Role",r=>esc(r.role||"—")],["Equity",r=>fmt(r.last.equity,5)+"x"],["Return",r=>pct((Number(r.last.equity)-1)*100,3)],["MDD",r=>pct(r.mdd,3)],["Gross",r=>pct(r.last.gross_exposure_pct,2)],["Open",r=>r.last.open_positions],["Date",r=>esc(r.last.date)]]);
 $("#forwardMeta").textContent="Signal boundary "+F.official_signal_boundary+" · last processed "+(F.last_processed_market_date||"—");
 const trades=F.trades||[];$("#tradeTable").innerHTML=trades.length?table(trades,[["Date",r=>esc(r.event_date)],["Lane",r=>esc(r.lane_id)],["Event",r=>esc(r.event_type)],["Symbol",r=>esc(r.symbol)],["Mechanism",r=>esc(r.mechanism)],["Entry",r=>esc(r.entry_price||"—")],["Risk %",r=>esc(r.risk_budget_pct||"—")],["Alloc %",r=>esc(r.capital_allocated_pct||"—")]]):"<div class='muted'>当前 feed 未包含交易事件明细。</div>";
}
function bindForward(){
 const dates=forwardDates();$("#forwardStart").min=dates[0];$("#forwardStart").max=dates.at(-1);$("#forwardEnd").min=dates[0];$("#forwardEnd").max=dates.at(-1);
 $("#forwardPresets").onclick=e=>{const b=e.target.closest("button[data-range]");if(!b)return;$$('#forwardPresets button').forEach(x=>x.classList.toggle("active",x===b));renderForward(presetWindow(dates,b.dataset.range))};
 $("#forwardApply").onclick=()=>renderForward([$("#forwardStart").value,$("#forwardEnd").value]);$("#forwardReset").onclick=()=>renderForward([dates[0],dates.at(-1)]);
 renderForward([dates[0],dates.at(-1)]);
}
function renderRegistryCards(){
 const p=H.phaseCoverage||{};
 const items=[
  ["基础结构 Phase",p.baseClassified!=null?p.baseClassified+"/"+p.baseTotal:"—"],
  ["Strict PASS",p.strictPassKnown??"—"],
  ["需要融资",p.financingRequiredKnown??"—"],
  ["仍待 Phase",p.baseUntested??"—"],
  ["权重场景 Phase",p.weightClassified!=null?p.weightClassified+"/"+p.weightTotal:"—"]
 ];
 $("#registryCards").innerHTML=items.map(x=>"<div class='metric'><span class='small'>"+esc(x[0])+"</span><b>"+esc(x[1])+"</b></div>").join("");
}
function renderRegistry(filter=""){
 const q=filter.trim().toLowerCase(),rows=H.registry.filter(r=>!q||[r.id,r.type,r.components.join(" "),r.weights,r.strictStatus,r.phaseCashEvidence,r.tradeCoverage].join(" ").toLowerCase().includes(q));
 $("#registryTable").innerHTML=table(rows,[["结构",r=>esc(r.id)],["类型",r=>esc(r.type)],["权重",r=>esc(r.weights)],["累计收益",r=>pct(r.totalReturnPct)],["CAGR",r=>pct(r.cagrPct)],["MaxDD",r=>pct(r.mddPct)],["Sharpe",r=>fmt(r.sharpe,3)],["月正收益占比",r=>pct(r.monthlyPositivePct)],["25bps CAGR",r=>pct(r.cost25CagrPct)],["Strict",r=>esc(r.strictStatus)],["Phase证据",r=>esc(r.phaseCashEvidence||"—")]])
}
(async()=>{
 bindTabs();
 H=await fetch("data/historical-top10.json?ts="+Date.now()).then(r=>r.json());
 F=await loadForward();
 $("#asof").textContent="HIST "+H.window.end+" · FWD "+(F.last_processed_market_date||"—");
 historyRange=[H.dates[0],H.dates.at(-1)];forwardRange=[forwardDates()[0],forwardDates().at(-1)];
 bindHistory();bindForward();renderRegistryCards();renderRegistry();$("#registrySearch").oninput=e=>renderRegistry(e.target.value);
})().catch(err=>{console.error(err);document.body.insertAdjacentHTML("beforeend","<div class='wrap bad'>Dashboard load error: "+esc(err.message||err)+"</div>")});