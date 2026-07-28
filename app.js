'use strict';

const APP_VERSION = '2.1.0';
const DB_NAME = 'lunaDailyDB';
const STORE = 'appState';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const todayISO = () => dateToISO(new Date());
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultState = {
  version: APP_VERSION,
  onboardingComplete: false,
  settings: {
    recentPeriodStart: todayISO(), typicalCycleLength: 28, typicalPeriodLength: 5,
    theme: 'dark', showFertileWindow: false, showMoonPhase: true,
    trackSexualActivity: false, trackCervicalFluid: false, trackTests: false,
    privacyCurtain: true, lastBackupAt: null, inAppNotifications: true
  },
  logs: {}, periods: [], excludedCycleStarts: [],
  notifications: { dismissed: {}, seenCycleSummaries: [], lastSeenAppVersion: APP_VERSION, updatedFromVersion: null }
};

let state = structuredClone(defaultState);
let route = 'today';
let calendarCursor = new Date(); calendarCursor.setDate(1);
let selectedCalendarDate = todayISO();
let db;
let storageMode = 'indexeddb';

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess=()=>{db=req.result;resolve(db)}; req.onerror=()=>reject(req.error);
  });
}
function dbGet(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get('primary');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbPut(value){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,'primary');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function saveState(){
  try{
    state.version=APP_VERSION;
    if(storageMode==='indexeddb') await dbPut(state);
    else localStorage.setItem(DB_NAME, JSON.stringify(state));
  }catch(e){toast('Could not save. Please create a backup.')}
}

function parseISO(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function dateToISO(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function addDays(s,n){const d=parseISO(s);d.setDate(d.getDate()+n);return dateToISO(d)}
function daysBetween(a,b){return Math.round((parseISO(b)-parseISO(a))/86400000)}
function fmtDate(s, opts={day:'numeric',month:'long',year:'numeric'}){return parseISO(s).toLocaleDateString('en-GB',opts)}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function mean(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0}

function rebuildPeriods(){
  const dates=Object.values(state.logs).filter(l=>l.countsAsPeriod && ['light','medium','heavy'].includes(l.bleeding)).map(l=>l.date).sort();
  const periods=[]; let group=[];
  for(const date of dates){
    if(!group.length || daysBetween(group.at(-1),date)<=1) group.push(date);
    else {periods.push(group);group=[date]}
  }
  if(group.length) periods.push(group);
  state.periods=periods.map((g,i)=>({id:`period-${g[0]}`,startDate:g[0],endDate:g.at(-1),status:(daysBetween(g.at(-1),todayISO())<=1)?'current':'complete',excludedFromPredictions:state.excludedCycleStarts.includes(g[0])}));
}
function cycleData(){
  rebuildPeriods();
  const starts=state.periods.map(p=>p.startDate).sort();
  const lengths=[];
  for(let i=0;i<starts.length-1;i++){
    const length=daysBetween(starts[i],starts[i+1]);
    if(length>=10&&length<=120&&!state.excludedCycleStarts.includes(starts[i])) lengths.push({start:starts[i],length});
  }
  const latestStart=starts.at(-1)||state.settings.recentPeriodStart;
  let predictedLength=Number(state.settings.typicalCycleLength)||28;
  let label='Initial estimate';
  if(lengths.length){
    const recent=lengths.slice(-6); let weighted=0,total=0;
    recent.forEach((x,i)=>{const w=i+1;weighted+=x.length*w;total+=w});
    const tracked=weighted/total;
    predictedLength=lengths.length<3 ? predictedLength*.25+tracked*.75 : tracked;
    label=lengths.length<3?'Early estimate':'Based on recent cycles';
  }
  const vals=lengths.slice(-6).map(x=>x.length);
  const mad=vals.length?mean(vals.map(v=>Math.abs(v-mean(vals)))):2;
  const allowance=clamp(Math.round(Math.max(2,mad)),2,10);
  const predictedStart=addDays(latestStart,Math.round(predictedLength));
  const cycleDay=Math.max(1,daysBetween(latestStart,todayISO())+1);
  const ovulation=addDays(predictedStart,-14);
  const period=state.periods.find(p=>todayISO()>=p.startDate&&todayISO()<=p.endDate);
  let phase='Follicular phase estimate';
  if(period) phase='Menstrual phase';
  else if(todayISO()>=addDays(ovulation,-2)&&todayISO()<=addDays(ovulation,1)) phase='Ovulation window estimate';
  else if(todayISO()>addDays(ovulation,1)) phase='Luteal phase estimate';
  return {starts,lengths,latestStart,predictedLength:Math.round(predictedLength),predictedStart,earliest:addDays(predictedStart,-allowance),latest:addDays(predictedStart,allowance),allowance,cycleDay,phase,label,ovulation};
}

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2400)}
function setTheme(){document.body.classList.toggle('light',state.settings.theme==='light'||(state.settings.theme==='system'&&matchMedia('(prefers-color-scheme:light)').matches))}
function setHeader(){const titles={today:'Today',calendar:'Calendar',insights:'Insights',settings:'Settings'};$('#screenTitle').textContent=titles[route];const h=new Date().getHours();$('#greeting').textContent=h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
function navigate(next){route=next;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===route));setHeader();render();$('#mainContent').focus({preventScroll:true})}

function render(){
  setTheme();
  if(!state.onboardingComplete){renderOnboarding();return}
  if(route==='today') renderToday();
  if(route==='calendar') renderCalendar();
  if(route==='insights') renderInsights();
  if(route==='settings') renderSettings();
}
function renderOnboarding(){
  $('#screenTitle').textContent='Welcome';$('.bottom-nav').style.display='none';$('#quickBackupBtn').style.visibility='hidden';
  $('#mainContent').innerHTML=$('#onboardingTemplate').innerHTML;
}
function installCard(){
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  return standalone?'':`<div class="card"><p class="eyebrow">Recommended on iPhone</p><h3>Install before entering real data</h3><p class="install-note">In Safari, tap Share, choose <b>Add to Home Screen</b>, enable <b>Open as Web App</b>, then launch Luna Daily from its icon.</p></div>`;
}
function renderToday(){
  $('.bottom-nav').style.display='grid';$('#quickBackupBtn').style.visibility='visible';
  const c=cycleData(), log=state.logs[todayISO()];
  const until=daysBetween(todayISO(),c.predictedStart);
  const timing=until>=0?`${until} day${until===1?'':'s'} until the central estimate`:`${Math.abs(until)} day${Math.abs(until)===1?'':'s'} beyond the central estimate`;
  const progress=clamp(((c.cycleDay-1)/Math.max(1,c.predictedLength))*100,0,100);
  $('#mainContent').innerHTML=`
    ${installCard()}
    ${notificationCentre()}
    <section class="card hero-card">
      <div class="aurora aurora-one"></div><div class="aurora aurora-two"></div>
      <span class="phase-pill">${c.phase}</span>
      <div class="dashboard-columns" style="margin-top:18px">
        <div class="hero-copy"><div class="big-number">Day ${c.cycleDay}</div><p class="muted">${timing}</p><p><b>Expected around ${fmtDate(c.predictedStart,{day:'numeric',month:'long'})}</b><br><span class="muted">Likely range ${fmtDate(c.earliest,{day:'numeric',month:'short'})}–${fmtDate(c.latest,{day:'numeric',month:'short'})} · ${c.label}</span></p></div>
        <div class="cycle-ring" style="--cycle-progress:${progress}deg;--marker-turn:${progress*3.6}deg"><span class="cycle-marker" aria-hidden="true"></span><div class="cycle-ring-inner"><b>${c.cycleDay}</b><span>cycle day</span></div></div>
      </div>
      <button class="primary-button" data-action="log-date" data-date="${todayISO()}">${log?'Edit today’s log':'Log today'}</button>
    </section>
    ${log?dailySummary(log):''}
    <div class="section-heading"><h2>Your cycle now</h2><p>Calendar estimate</p></div>
    ${phaseJourney(c)}
    <div class="grid-2">
      <div class="metric"><span class="muted">Typical cycle</span><strong>${c.predictedLength} days</strong></div>
      <div class="metric"><span class="muted">Typical period</span><strong>${averagePeriodLength()} days</strong></div>
    </div>
    <div class="section-heading"><h2>About this phase</h2></div>
    <section class="card phase-guidance"><div class="phase-symbol">${phaseSymbol(c.phase)}</div><div><h3>${cleanPhaseName(c.phase)}</h3><p>${phaseGuidance(c.phase)}</p><p class="muted phase-note">General educational information only. The app estimates phases from dates and cannot confirm ovulation or hormone levels.</p></div></section>
    `;
}

function cleanPhaseName(phase){return phase.replace(' estimate','').replace(' window','')}
function phaseSymbol(phase){if(phase.includes('Menstrual'))return '●';if(phase.includes('Ovulation'))return '✦';if(phase.includes('Luteal'))return '◕';return '◒'}
function phaseJourney(c){
  const phases=[
    {key:'Menstrual',name:'Menstrual',detail:'Recorded bleeding days',symbol:'●'},
    {key:'Follicular',name:'Follicular',detail:'After the period',symbol:'◒'},
    {key:'Ovulation',name:'Ovulation',detail:`Estimated near ${fmtDate(c.ovulation,{day:'numeric',month:'short'})}`,symbol:'✦'},
    {key:'Luteal',name:'Luteal',detail:'Before the next period',symbol:'◕'}
  ];
  return `<section class="card phase-journey"><div class="phase-track" aria-label="Estimated cycle phases">${phases.map((p,i)=>{const active=c.phase.includes(p.key);return `<div class="phase-step ${active?'active':''}"><div class="phase-dot"><span>${p.symbol}</span></div><b>${p.name}</b><small>${p.detail}</small></div>${i<phases.length-1?'<div class="phase-connector"></div>':''}`}).join('')}</div>${state.settings.showFertileWindow?`<div class="fertile-note"><span>✦</span><p><b>Estimated fertile window</b><br><span class="muted">Approximately ${fmtDate(addDays(c.ovulation,-5),{day:'numeric',month:'short'})}–${fmtDate(addDays(c.ovulation,1),{day:'numeric',month:'short'})}. This cannot confirm fertility and should not be used as contraception.</span></p></div>`:''}</section>`
}

function dailySummary(log){
  const items=[];if(log.bleeding&&log.bleeding!=='none')items.push(['Bleeding',capitalize(log.bleeding)]);if(log.symptoms?.length)items.push(['Symptoms',log.symptoms.map(s=>capitalize(s.name)).join(', ')]);if(log.moods?.length)items.push(['Mood',log.moods.map(capitalize).join(', ')]);if(log.energy)items.push(['Energy',['','Very low','Low','Average','High','Very high'][log.energy]]);
  return `<div class="section-heading"><h2>Today</h2></div><section class="card summary-list">${items.length?items.map(([a,b])=>`<div class="summary-row"><span class="muted">${a}</span><b>${b}</b></div>`).join(''):'<p class="muted">A note was saved for today.</p>'}</section>`;
}
function phaseGuidance(phase){if(phase.includes('Menstrual'))return 'Energy and comfort can vary during bleeding days. Rest, hydration and the relief methods that usually work for you may be helpful.';if(phase.includes('Ovulation'))return 'This is a calendar-based phase estimate. Some people notice changes in discharge, energy or libido, but the app cannot confirm ovulation.';if(phase.includes('Luteal'))return 'Some people notice shifts in energy, appetite, sleep or mood later in the cycle. Patterns become clearer through regular logging.';return 'Energy and wellbeing may change throughout this part of the cycle. Logging only what feels useful is enough.'}
function notificationKey(type, context=''){return `${type}:${context}`}
function isNotificationDismissed(key){
  const until=state.notifications?.dismissed?.[key];
  if(!until)return false;
  if(until==='forever')return true;
  return todayISO()<=until;
}
function notificationCard(n){
  return `<article class="notice-card notice-${n.type}" data-notice-key="${escapeHTML(n.key)}">
    <div class="notice-icon" aria-hidden="true">${n.icon}</div>
    <div class="notice-copy"><p class="eyebrow">${n.eyebrow}</p><h3>${n.title}</h3><p>${n.body}</p>${n.meta?`<div class="notice-meta">${n.meta}</div>`:''}
      <div class="notice-actions">${n.actions.map(a=>`<button class="${a.primary?'primary-button':'text-button'}" data-action="${a.action}" ${a.date?`data-date="${a.date}"`:''} ${a.key?`data-key="${escapeHTML(a.key)}"`:''}>${a.label}</button>`).join('')}</div>
    </div>
    ${n.dismissible?`<button class="notice-dismiss" data-action="dismiss-notice" data-key="${escapeHTML(n.key)}" data-days="${n.dismissDays??''}" aria-label="Dismiss notification">×</button>`:''}
  </article>`;
}
function endCycleSummaryNotice(c){
  if(c.starts.length<2)return null;
  const currentStart=c.starts.at(-1), previousStart=c.starts.at(-2);
  if(daysBetween(currentStart,todayISO())>7)return null;
  if((state.notifications.seenCycleSummaries||[]).includes(currentStart))return null;
  const cycleLength=daysBetween(previousStart,currentStart);
  const previousPeriod=state.periods.find(p=>p.startDate===previousStart);
  const periodLength=previousPeriod?daysBetween(previousPeriod.startDate,previousPeriod.endDate)+1:null;
  const cycleLogs=Object.values(state.logs).filter(l=>l.date>=previousStart&&l.date<currentStart);
  const moods={};const symptoms={};
  cycleLogs.forEach(l=>{(l.moods||[]).forEach(x=>moods[x]=(moods[x]||0)+1);(l.symptoms||[]).forEach(x=>symptoms[x.name]=(symptoms[x.name]||0)+1)});
  const top=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const meta=[`Cycle length: <b>${cycleLength} days</b>`,periodLength?`Period length: <b>${periodLength} days</b>`:'',top(moods)?`Most logged mood: <b>${capitalize(top(moods))}</b>`:'',top(symptoms)?`Most logged symptom: <b>${capitalize(top(symptoms))}</b>`:''].filter(Boolean).join('<span>•</span>');
  const key=notificationKey('cycle-summary',currentStart);
  return {type:'summary',key,icon:'◔',eyebrow:'Cycle summary',title:'Your previous cycle is complete',body:'Here is a quick look at what you recorded before this period began.',meta,actions:[{label:'View insights',action:'view-insights',primary:true},{label:'Done',action:'mark-cycle-summary',key}],dismissible:false};
}
function symptomInsightNotice(c){
  if(c.starts.length<4)return null;
  const occurrences={};
  for(let i=1;i<c.starts.length;i++){
    const start=c.starts[i];
    const cycleId=start;
    for(let offset=1;offset<=3;offset++){
      const log=state.logs[addDays(start,-offset)];
      (log?.symptoms||[]).forEach(s=>{
        const k=s.name;occurrences[k]??=new Set();occurrences[k].add(cycleId);
      });
    }
  }
  const best=Object.entries(occurrences).map(([name,set])=>[name,set.size]).filter(([,count])=>count>=3).sort((a,b)=>b[1]-a[1])[0];
  if(!best)return null;
  const [name,count]=best,key=notificationKey('symptom-insight',`${name}-${count}`);
  if(isNotificationDismissed(key))return null;
  return {type:'insight',key,icon:'⌁',eyebrow:'Pattern noticed',title:`${capitalize(name)} often appears before your period`,body:`You logged this symptom during the 1–3 days before ${count} recent periods. This describes your records only and does not establish a medical cause.`,actions:[{label:'View insights',action:'view-insights',primary:true}],dismissible:true,dismissDays:'forever'};
}
function buildNotifications(){
  if(!state.settings.inAppNotifications)return [];
  const c=cycleData(),today=todayISO(),notices=[];
  if(state.notifications.updatedFromVersion&&state.notifications.lastSeenAppVersion!==APP_VERSION){
    const key=notificationKey('app-update',APP_VERSION);
    notices.push({type:'update',key,icon:'✦',eyebrow:'App updated',title:`Luna Daily ${APP_VERSION} is ready`,body:'In-app reminders have been added for daily logging, cycle timing, backups, cycle summaries and personal symptom patterns.',actions:[{label:'Got it',action:'ack-update',key,primary:true}],dismissible:false});
  }
  if(!state.logs[today]){
    const key=notificationKey('daily-checkin',today);
    if(!isNotificationDismissed(key))notices.push({type:'checkin',key,icon:'☾',eyebrow:'Daily check-in',title:'How are you feeling today?',body:'A quick entry helps keep your cycle history and personal patterns up to date.',actions:[{label:'Log today',action:'log-date',date:today,primary:true},{label:'Remind me later',action:'dismiss-notice',key}],dismissible:false});
  }
  const dueIn=daysBetween(today,c.predictedStart);
  if(dueIn>=0&&dueIn<=3&&!state.periods.some(p=>today>=p.startDate&&today<=p.endDate)){
    const key=notificationKey('period-due',c.predictedStart);
    if(!isNotificationDismissed(key))notices.push({type:'period',key,icon:'●',eyebrow:'Period estimate',title:dueIn===0?'Your period is estimated around today':`Your period may begin in ${dueIn} day${dueIn===1?'':'s'}`,body:`The current likely range is ${fmtDate(c.earliest,{day:'numeric',month:'short'})}–${fmtDate(c.latest,{day:'numeric',month:'short'})}. Predictions are estimates and may shift as you add data.`,actions:[{label:'Open calendar',action:'view-calendar',primary:true}],dismissible:true,dismissDays:3});
  }
  const fertileStart=addDays(c.ovulation,-5),fertileEnd=addDays(c.ovulation,1);
  if(state.settings.showFertileWindow&&today>=fertileStart&&today<=fertileEnd){
    const key=notificationKey('fertile-window',c.ovulation);
    if(!isNotificationDismissed(key))notices.push({type:'fertile',key,icon:'✦',eyebrow:'Fertile-window estimate',title:'You are within the estimated fertile window',body:`Ovulation is currently estimated near ${fmtDate(c.ovulation,{weekday:'long',day:'numeric',month:'short'})}. Calendar estimates cannot confirm fertility and should not be used as contraception.`,actions:[{label:'View cycle',action:'scroll-cycle',primary:true}],dismissible:true,dismissDays:7});
  }
  const backupAge=state.settings.lastBackupAt?daysBetween(state.settings.lastBackupAt.slice(0,10),today):null;
  if(backupAge===null||backupAge>=30){
    const bucket=backupAge===null?'first':Math.floor(backupAge/7);
    const key=notificationKey('backup',bucket);
    if(!isNotificationDismissed(key))notices.push({type:'backup',key,icon:'⇩',eyebrow:'Protect your history',title:backupAge===null?'Create your first backup':`Your last backup was ${backupAge} days ago`,body:'An encrypted backup can protect your entries if browser or app data is removed.',actions:[{label:'Create backup',action:'export-backup',primary:true},{label:'Remind me next week',action:'dismiss-notice',key}],dismissible:false});
  }
  const summary=endCycleSummaryNotice(c);if(summary)notices.push(summary);
  const insight=symptomInsightNotice(c);if(insight)notices.push(insight);
  return notices;
}
function notificationCentre(){
  const notices=buildNotifications();if(!notices.length)return '';
  return `<section class="notice-centre"><div class="section-heading notice-heading"><h2>For you today</h2><p>${notices.length} reminder${notices.length===1?'':'s'}</p></div><div class="notice-stack">${notices.map(notificationCard).join('')}</div></section>`;
}
function averagePeriodLength(){rebuildPeriods();const complete=state.periods.filter(p=>p.status==='complete');return complete.length?Math.round(mean(complete.map(p=>daysBetween(p.startDate,p.endDate)+1))):state.settings.typicalPeriodLength}

function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();const first=new Date(y,m,1);const gridStart=new Date(y,m,1-((first.getDay()+6)%7));const c=cycleData();
  let days='';for(let i=0;i<42;i++){const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);const iso=dateToISO(d);const log=state.logs[iso];const confirmed=state.periods.some(p=>iso>=p.startDate&&iso<=p.endDate);const predicted=iso>=c.predictedStart&&iso<addDays(c.predictedStart,state.settings.typicalPeriodLength);days+=`<button class="day ${d.getMonth()!==m?'other':''} ${iso===todayISO()?'today':''} ${confirmed?'period':''} ${predicted&&!confirmed?'predicted':''} ${log?'has-log':''} ${iso===selectedCalendarDate?'selected':''}" data-action="select-day" data-date="${iso}" aria-label="${fmtDate(iso)}${confirmed?', period logged':''}${log?', entry saved':''}">${d.getDate()}</button>`}
  const selected=state.logs[selectedCalendarDate];
  $('#mainContent').innerHTML=`<section class="card"><div class="calendar-head"><button data-action="month-prev" aria-label="Previous month">‹</button><h2>${calendarCursor.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h2><button data-action="month-next" aria-label="Next month">›</button></div><div class="calendar-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class="weekday">${x}</div>`).join('')}${days}</div><div class="calendar-legend"><span><i class="legend-dot confirmed"></i>Logged period</span><span><i class="legend-dot predicted"></i>Predicted period</span><span>• Daily entry</span></div></section><section class="card"><p class="eyebrow">${fmtDate(selectedCalendarDate,{weekday:'long',day:'numeric',month:'long'})}</p>${selected?dailySummary(selected).replace('<section class="card summary-list">','<div class="summary-list">').replace('</section>','</div>'):'<p class="muted">Nothing logged for this day.</p>'}<button class="primary-button" data-action="log-date" data-date="${selectedCalendarDate}">${selected?'Edit entry':'Log this day'}</button></section>`;
}

function renderInsights(){
  const c=cycleData();const vals=c.lengths.slice(-6);const max=Math.max(35,...vals.map(x=>x.length));
  const chart=vals.length?`<div class="bar-chart">${vals.map(x=>`<div class="bar-wrap"><b>${x.length}</b><div class="bar" style="height:${Math.max(12,x.length/max*125)}px"></div><small>${fmtDate(x.start,{day:'numeric',month:'short'})}</small></div>`).join('')}</div>`:`<div class="empty">Cycle charts will appear after two period start dates have been logged.</div>`;
  const symptoms=symptomCounts();
  $('#mainContent').innerHTML=`<div class="grid-2"><div class="metric"><span class="muted">Average cycle</span><strong>${c.lengths.length?Math.round(mean(c.lengths.map(x=>x.length))):'—'}</strong><span class="muted">days</span></div><div class="metric"><span class="muted">Completed cycles</span><strong>${c.lengths.length}</strong></div><div class="metric"><span class="muted">Shortest</span><strong>${c.lengths.length?Math.min(...c.lengths.map(x=>x.length)):'—'}</strong><span class="muted">days</span></div><div class="metric"><span class="muted">Longest</span><strong>${c.lengths.length?Math.max(...c.lengths.map(x=>x.length)):'—'}</strong><span class="muted">days</span></div></div><div class="section-heading"><h2>Recent cycle lengths</h2></div><section class="card">${chart}</section><div class="section-heading"><h2>Commonly logged</h2></div><section class="card">${symptoms.length?symptoms.slice(0,5).map(([name,count])=>`<div class="summary-row"><span>${capitalize(name)}</span><b>${count} day${count===1?'':'s'}</b></div>`).join(''):'<div class="empty">Symptom patterns will appear as you add daily entries.</div>'}</section><section class="card warning">Insights describe your own records only. They do not diagnose a condition or prove a hormonal cause.</section>`;
}
function symptomCounts(){const counts={};Object.values(state.logs).forEach(l=>(l.symptoms||[]).forEach(s=>counts[s.name]=(counts[s.name]||0)+1));return Object.entries(counts).sort((a,b)=>b[1]-a[1])}

function renderSettings(){
  $('#mainContent').innerHTML=`
  <div class="settings-group"><h3>Cycle setup</h3><section class="card"><div class="settings-row"><div><span>Typical cycle length</span><small>Used until enough history exists</small></div><b>${state.settings.typicalCycleLength} days</b></div><div class="settings-row"><div><span>Typical period length</span></div><b>${state.settings.typicalPeriodLength} days</b></div><button class="secondary-button" data-action="edit-cycle-settings" style="margin-top:14px">Edit cycle settings</button></section></div>
  <div class="settings-group"><h3>Tracking</h3><section class="card">${toggleRow('Show fertile-window estimate','showFertileWindow')}${toggleRow('Track sexual activity','trackSexualActivity')}${toggleRow('Track cervical fluid','trackCervicalFluid')}${toggleRow('Track pregnancy and ovulation tests','trackTests')}</section></div>
  <div class="settings-group"><h3>Reminders</h3><section class="card">${toggleRow('Show smart in-app reminders','inAppNotifications')}<p class="muted" style="font-size:12px;margin:12px 0 0">Reminders appear only when Luna Daily is opened. They are calculated privately on this device.</p></section></div>
  <div class="settings-group"><h3>Appearance & privacy</h3><section class="card"><div class="settings-row"><div><span>Theme</span><small>Dark, light or device setting</small></div><button class="chip" data-action="cycle-theme">${capitalize(state.settings.theme)}</button></div>${toggleRow('Privacy curtain in app switcher','privacyCurtain')}</section></div>
  <div class="settings-group"><h3>Backup & data</h3><section class="card"><button class="secondary-button" data-action="export-backup">Export backup</button><button class="secondary-button" data-action="restore-backup" style="margin-top:10px">Restore backup</button><p class="muted" style="font-size:12px">Last backup: ${state.settings.lastBackupAt?fmtDate(state.settings.lastBackupAt.slice(0,10)):'Never'}</p><button class="danger-button" data-action="delete-all" style="margin-top:12px">Delete all data</button></section></div>
  <div class="settings-group"><h3>About</h3><section class="card"><p><b>Luna Daily v${APP_VERSION}</b></p><p class="muted">This tracker provides estimates and general educational information. It cannot diagnose a condition, confirm ovulation or pregnancy, or replace qualified medical advice.</p>${state.settings.showFertileWindow?'<p class="warning">Calendar fertility estimates should not be used as your only method of contraception.</p>':''}</section></div>`;
}
function toggleRow(label,key){return `<div class="toggle-row"><span>${label}</span><button class="toggle ${state.settings[key]?'on':''}" data-action="toggle-setting" data-key="${key}" role="switch" aria-checked="${state.settings[key]}"></button></div>`}

function showModal(html){$('#modalRoot').innerHTML=`<div class="modal-backdrop"><section class="modal-sheet" role="dialog" aria-modal="true">${html}</section></div>`;$('.modal-sheet').focus()}
function closeModal(){$('#modalRoot').innerHTML=''}
function onboardingModal(){showModal(`<div class="modal-head"><h2>Set up your cycle</h2><button class="close-button" data-action="close-modal">×</button></div><form id="onboardingForm"><div class="field"><label for="recentStart">First day of your most recent period</label><input class="input" id="recentStart" name="recentStart" type="date" max="${todayISO()}" value="${state.settings.recentPeriodStart}" required></div><div class="field"><label>Typical cycle length</label><div class="chips" data-single="cycleLength">${[24,26,28,30,32,35].map(v=>`<button type="button" class="chip ${v===28?'selected':''}" data-value="${v}">${v} days</button>`).join('')}</div><input type="hidden" name="cycleLength" value="28"></div><div class="field"><label>Typical period length</label><div class="chips" data-single="periodLength">${[3,4,5,6,7].map(v=>`<button type="button" class="chip ${v===5?'selected':''}" data-value="${v}">${v} days</button>`).join('')}</div><input type="hidden" name="periodLength" value="5"></div><label class="toggle-row"><span>I understand that deleting browser or app data may remove my entries.</span><input type="checkbox" name="ack" required></label><button class="primary-button" type="submit">Create my tracker</button></form>`)}

function logModal(date){
  const l=state.logs[date]||{date,bleeding:'none',countsAsPeriod:false,symptoms:[],moods:[],energy:null,sleepHours:'',sleepQuality:'',cervicalFluid:null,sexualActivity:[],pregnancyTest:null,ovulationTest:null,medication:'',notes:''};
  const bleed=['none','spotting','light','medium','heavy'];const symptoms=['cramps','bloating','headache','migraine','breast tenderness','back pain','pelvic pain','nausea','digestive changes','acne','cravings','fatigue','dizziness','hot flushes'];const moods=['calm','happy','confident','sociable','focused','sensitive','anxious','irritable','low','overwhelmed','tearful','emotionally flat'];
  showModal(`<div class="modal-head"><div><p class="eyebrow">Daily log</p><h2>${fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}</h2></div><button class="close-button" data-action="close-modal">×</button></div><form id="logForm" data-date="${date}">
  <div class="field"><label>Bleeding</label><div class="chips" data-single="bleeding">${bleed.map(v=>`<button type="button" class="chip ${l.bleeding===v?'period-selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div><input type="hidden" name="bleeding" value="${l.bleeding}"></div>
  <div class="field"><label class="toggle-row"><span>Count this as part of a period</span><input type="checkbox" name="countsAsPeriod" ${l.countsAsPeriod?'checked':''}></label><small>Spotting alone will not start a new cycle unless you choose this.</small></div>
  <div class="field"><label>Physical symptoms</label><div class="chips" data-multi="symptoms">${symptoms.map(v=>`<button type="button" class="chip ${l.symptoms.some(s=>s.name===v)?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div></div>
  <div class="field"><label>Mood</label><div class="chips" data-multi="moods">${moods.map(v=>`<button type="button" class="chip ${l.moods.includes(v)?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div></div>
  <div class="field"><label>Energy</label><div class="chips" data-single="energy">${['Very low','Low','Average','High','Very high'].map((v,i)=>`<button type="button" class="chip ${l.energy===i+1?'selected':''}" data-value="${i+1}">${v}</button>`).join('')}</div><input type="hidden" name="energy" value="${l.energy||''}"></div>
  <div class="grid-2"><div class="field"><label for="sleepHours">Sleep hours</label><input class="input" id="sleepHours" name="sleepHours" type="number" min="0" max="24" step="0.5" value="${l.sleepHours||''}"></div><div class="field"><label>Sleep quality</label><div class="chips" data-single="sleepQuality">${['poor','fair','good','excellent'].map(v=>`<button type="button" class="chip ${l.sleepQuality===v?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div><input type="hidden" name="sleepQuality" value="${l.sleepQuality||''}"></div></div>
  ${state.settings.trackCervicalFluid?`<div class="field"><label>Cervical fluid</label><div class="chips" data-single="cervicalFluid">${['dry','sticky','creamy','watery','egg-white','unsure'].map(v=>`<button type="button" class="chip ${l.cervicalFluid===v?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div><input type="hidden" name="cervicalFluid" value="${l.cervicalFluid||''}"></div>`:''}
  ${state.settings.trackSexualActivity?`<div class="field"><label>Sexual activity</label><div class="chips" data-multi="sexualActivity">${['sexual activity','protected','unprotected','high libido','low libido'].map(v=>`<button type="button" class="chip ${(l.sexualActivity||[]).includes(v)?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div></div>`:''}
  ${state.settings.trackTests?`<div class="field"><label>Pregnancy test</label><div class="chips" data-single="pregnancyTest">${['positive','negative','unclear'].map(v=>`<button type="button" class="chip ${l.pregnancyTest===v?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div><input type="hidden" name="pregnancyTest" value="${l.pregnancyTest||''}"></div><div class="field"><label>Ovulation test</label><div class="chips" data-single="ovulationTest">${['positive','negative','unclear'].map(v=>`<button type="button" class="chip ${l.ovulationTest===v?'selected':''}" data-value="${v}">${capitalize(v)}</button>`).join('')}</div><input type="hidden" name="ovulationTest" value="${l.ovulationTest||''}"></div>`:''}
  <div class="field"><label for="medication">Medication or relief used</label><input class="input" id="medication" name="medication" maxlength="200" value="${escapeHTML(l.medication||'')}"></div><div class="field"><label for="notes">Notes</label><textarea class="input" id="notes" name="notes" maxlength="2000">${escapeHTML(l.notes||'')}</textarea></div>
  <div class="button-row">${state.logs[date]?'<button type="button" class="danger-button" data-action="delete-log" data-date="'+date+'">Delete</button>':''}<button class="primary-button" type="submit">Save entry</button></div></form>`);
}
function editCycleModal(){showModal(`<div class="modal-head"><h2>Cycle settings</h2><button class="close-button" data-action="close-modal">×</button></div><form id="cycleSettingsForm"><div class="field"><label for="recentPeriodStart">Most recent known period start</label><input class="input" id="recentPeriodStart" name="recentPeriodStart" type="date" max="${todayISO()}" value="${state.settings.recentPeriodStart}"></div><div class="field"><label for="typicalCycleLength">Typical cycle length</label><input class="input" id="typicalCycleLength" name="typicalCycleLength" type="number" min="15" max="60" value="${state.settings.typicalCycleLength}"></div><div class="field"><label for="typicalPeriodLength">Typical period length</label><input class="input" id="typicalPeriodLength" name="typicalPeriodLength" type="number" min="1" max="14" value="${state.settings.typicalPeriodLength}"></div><button class="primary-button">Save settings</button></form>`)}

function bindEvents(){
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action],.nav-item,.chips .chip');if(!btn)return;
    if(btn.classList.contains('nav-item')){navigate(btn.dataset.route);return}
    if(btn.matches('.chips .chip')){const group=btn.closest('.chips');if(group.dataset.single){group.querySelectorAll('.chip').forEach(x=>x.classList.remove('selected','period-selected'));btn.classList.add(group.dataset.single==='bleeding'?'period-selected':'selected');group.parentElement.querySelector(`input[name="${group.dataset.single}"]`).value=btn.dataset.value}else btn.classList.toggle('selected');return}
    const a=btn.dataset.action;
    if(a==='start-onboarding')onboardingModal();
    if(a==='close-modal')closeModal();
    if(a==='log-date')logModal(btn.dataset.date);
    if(a==='select-day'){selectedCalendarDate=btn.dataset.date;renderCalendar()}
    if(a==='month-prev'){calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar()}
    if(a==='month-next'){calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar()}
    if(a==='toggle-setting'){const k=btn.dataset.key;state.settings[k]=!state.settings[k];await saveState();render()}
    if(a==='cycle-theme'){state.settings.theme={dark:'light',light:'system',system:'dark'}[state.settings.theme];await saveState();render()}
    if(a==='edit-cycle-settings')editCycleModal();
    if(a==='export-backup')backupPrompt();
    if(a==='restore-backup')restoreBackupPrompt();
    if(a==='dismiss-notice'){
      const key=btn.dataset.key,days=btn.dataset.days;
      state.notifications.dismissed[key]=days==='forever'?'forever':addDays(todayISO(),Number(days)||0);
      await saveState();render();
    }
    if(a==='ack-update'){state.notifications.lastSeenAppVersion=APP_VERSION;state.notifications.updatedFromVersion=null;await saveState();render()}
    if(a==='view-calendar')navigate('calendar');
    if(a==='view-insights')navigate('insights');
    if(a==='scroll-cycle')document.querySelector('.phase-journey')?.scrollIntoView({behavior:'smooth',block:'center'});
    if(a==='mark-cycle-summary'){
      const cycleStart=btn.dataset.key.split(':').slice(1).join(':');
      if(!state.notifications.seenCycleSummaries.includes(cycleStart))state.notifications.seenCycleSummaries.push(cycleStart);
      await saveState();render();
    }
    if(a==='delete-log'){delete state.logs[btn.dataset.date];rebuildPeriods();await saveState();closeModal();render();toast('Entry deleted')}
    if(a==='delete-all')deleteAllPrompt();
  });
  document.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target;
    if(f.id==='onboardingForm'){const data=new FormData(f);state.settings.recentPeriodStart=data.get('recentStart');state.settings.typicalCycleLength=Number(data.get('cycleLength'));state.settings.typicalPeriodLength=Number(data.get('periodLength'));state.onboardingComplete=true;state.logs[state.settings.recentPeriodStart]={date:state.settings.recentPeriodStart,bleeding:'medium',countsAsPeriod:true,symptoms:[],moods:[],energy:null,sleepHours:'',sleepQuality:'',medication:'',notes:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};rebuildPeriods();await saveState();closeModal();render();toast('Your tracker is ready')}
    if(f.id==='logForm'){const data=new FormData(f),date=f.dataset.date;const existing=state.logs[date];state.logs[date]={date,bleeding:data.get('bleeding'),countsAsPeriod:data.get('countsAsPeriod')==='on',symptoms:selectedValues(f,'symptoms').map(name=>({name,severity:'moderate'})),moods:selectedValues(f,'moods'),energy:Number(data.get('energy'))||null,sleepHours:data.get('sleepHours')?Number(data.get('sleepHours')):'',sleepQuality:data.get('sleepQuality')||'',cervicalFluid:data.get('cervicalFluid')||null,sexualActivity:selectedValues(f,'sexualActivity'),pregnancyTest:data.get('pregnancyTest')||null,ovulationTest:data.get('ovulationTest')||null,medication:data.get('medication').trim(),notes:data.get('notes').trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};rebuildPeriods();state.notifications.dismissed[notificationKey('daily-checkin',date)]='forever';await saveState();closeModal();render();toast('Entry saved')}
    if(f.id==='cycleSettingsForm'){const data=new FormData(f);state.settings.recentPeriodStart=data.get('recentPeriodStart');state.settings.typicalCycleLength=clamp(Number(data.get('typicalCycleLength')),15,60);state.settings.typicalPeriodLength=clamp(Number(data.get('typicalPeriodLength')),1,14);await saveState();closeModal();render();toast('Settings saved')}
    if(f.id==='backupForm'){const data=new FormData(f),password=String(data.get('password')||''),confirm=String(data.get('confirmPassword')||'');if(password&&password.length<8){toast('Use at least 8 characters');return}if(password!==confirm){toast('Passwords do not match');return}await exportBackup(password)}
    if(f.id==='restoreForm')await restoreFromFile(f);
    if(f.id==='deleteAllForm'){if(new FormData(f).get('confirm')==='DELETE'){state=structuredClone(defaultState);await saveState();closeModal();route='today';render();toast('All data deleted')}else toast('Type DELETE exactly')}
  });
  $('#quickBackupBtn').addEventListener('click',backupPrompt);
  document.addEventListener('visibilitychange',()=>{if(state.settings.privacyCurtain)$('#privacyCurtain').classList.toggle('show',document.hidden)});
}
function selectedValues(form,name){const group=form.querySelector(`[data-multi="${name}"]`);return group?[...group.querySelectorAll('.chip.selected')].map(x=>x.dataset.value):[]}

function backupPrompt(){
  showModal(`<div class="modal-head"><div><p class="eyebrow">Private backup</p><h2>Export your data</h2></div><button class="close-button" data-action="close-modal">×</button></div>
  <form id="backupForm">
    <p class="muted">Create an encrypted backup for safer storage, or leave the password blank for a standard readable JSON backup.</p>
    <div class="field"><label for="backupPassword">Backup password (optional)</label><input class="input" id="backupPassword" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div>
    <div class="field"><label for="backupPasswordConfirm">Confirm password</label><input class="input" id="backupPasswordConfirm" name="confirmPassword" type="password" autocomplete="new-password"></div>
    <p class="warning">An encrypted backup cannot be restored without its password.</p>
    <button class="primary-button">Export backup</button>
  </form>`);
}
async function deriveKey(password,salt){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function bytesToB64(bytes){let str='';bytes.forEach(b=>str+=String.fromCharCode(b));return btoa(str)}
function b64ToBytes(str){return Uint8Array.from(atob(str),c=>c.charCodeAt(0))}
async function exportBackup(password=''){
  try{
    const payload={schemaVersion:2,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),data:state};
    let output,ext='json';
    if(password){
      const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const key=await deriveKey(password,salt);
      const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(payload))));
      output=JSON.stringify({format:'luna-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations:250000,cipher:'AES-GCM',salt:bytesToB64(salt),iv:bytesToB64(iv),data:bytesToB64(encrypted)},null,2);
      ext='luna';
    }else output=JSON.stringify(payload,null,2);
    const blob=new Blob([output],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`luna-daily-backup-${todayISO()}.${ext}`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
    state.settings.lastBackupAt=new Date().toISOString();await saveState();closeModal();render();toast(password?'Encrypted backup exported':'Backup exported');
  }catch(e){toast('Backup could not be created')}
}
function restoreBackupPrompt(){showModal(`<div class="modal-head"><div><p class="eyebrow">Restore</p><h2>Restore a backup</h2></div><button class="close-button" data-action="close-modal">×</button></div><form id="restoreForm"><div class="field"><label for="backupFile">Choose a Luna Daily backup</label><input class="input" id="backupFile" name="backupFile" type="file" accept="application/json,.json,.luna" required></div><div class="field"><label for="restorePassword">Password (encrypted backups only)</label><input class="input" id="restorePassword" name="password" type="password" autocomplete="current-password"></div><p class="warning">Restoring replaces the data currently held in this app.</p><button class="primary-button">Restore backup</button></form>`)}
async function restoreFromFile(form){
  try{
    const fd=new FormData(form),file=fd.get('backupFile'),password=String(fd.get('password')||''),raw=JSON.parse(await file.text());let parsed=raw;
    if(raw.format==='luna-encrypted-backup'){
      if(!password) throw new Error('Password required');
      const key=await deriveKey(password,b64ToBytes(raw.salt));
      const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(raw.iv)},key,b64ToBytes(raw.data));
      parsed=JSON.parse(new TextDecoder().decode(decrypted));
    }
    if(![1,2].includes(parsed.schemaVersion)||!parsed.data?.settings||!parsed.data?.logs)throw new Error('Invalid');
    state={...structuredClone(defaultState),...parsed.data,settings:{...defaultState.settings,...parsed.data.settings}};
    await saveState();closeModal();render();toast('Backup restored');
  }catch(e){toast('Backup could not be restored. Check the file and password.')}
}
function deleteAllPrompt(){showModal(`<div class="modal-head"><h2>Delete all data</h2><button class="close-button" data-action="close-modal">×</button></div><form id="deleteAllForm"><p class="warning">This permanently removes all locally stored cycle records and settings from this app.</p><div class="field"><label for="confirmDelete">Type DELETE to confirm</label><input class="input" id="confirmDelete" name="confirm" autocomplete="off"></div><button class="danger-button">Delete everything</button></form>`)}
function capitalize(s){return String(s||'').replace(/\b\w/g,c=>c.toUpperCase())}
function escapeHTML(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

async function init(){
  try{await openDB();const saved=await dbGet();if(saved){const previousVersion=saved.version||'unknown';state={...structuredClone(defaultState),...saved,settings:{...defaultState.settings,...saved.settings},notifications:{...defaultState.notifications,...saved.notifications,dismissed:{...defaultState.notifications.dismissed,...saved.notifications?.dismissed},seenCycleSummaries:[...(saved.notifications?.seenCycleSummaries||[])]}};if(previousVersion!==APP_VERSION){state.notifications.updatedFromVersion=previousVersion;state.notifications.lastSeenAppVersion=previousVersion;}}else await dbPut(state)}catch(e){
    storageMode='localstorage';
    try{const raw=localStorage.getItem(DB_NAME);if(raw){const saved=JSON.parse(raw),previousVersion=saved.version||'unknown';state={...structuredClone(defaultState),...saved,settings:{...defaultState.settings,...saved.settings},notifications:{...defaultState.notifications,...saved.notifications,dismissed:{...defaultState.notifications.dismissed,...saved.notifications?.dismissed},seenCycleSummaries:[...(saved.notifications?.seenCycleSummaries||[])]}};if(previousVersion!==APP_VERSION){state.notifications.updatedFromVersion=previousVersion;state.notifications.lastSeenAppVersion=previousVersion;}}else localStorage.setItem(DB_NAME,JSON.stringify(state));}
    catch(err){alert('Luna Daily could not access private browser storage on this device.');return}
  }
  if(state.version!==APP_VERSION||state.notifications.updatedFromVersion)await saveState();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  bindEvents();setHeader();render();
}
if (globalThis.__LUNA_TEST_MODE__) {
  globalThis.__LUNA_TEST_API__ = {
    parseISO, dateToISO, addDays, daysBetween, clamp, mean, rebuildPeriods, cycleData, buildNotifications, notificationKey, isNotificationDismissed,
    setState(value) { state = structuredClone(value); },
    getState() { return structuredClone(state); },
    defaultState: structuredClone(defaultState)
  };
} else {
  init();
}
