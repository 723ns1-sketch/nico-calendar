(()=>{'use strict';
const $=id=>document.getElementById(id),TC='nico-hertz-timecards-v1',PAY='nico-hertz-pay-v1',STORE='nico-hertz-paychecks-v1';
const defaults={deductionPercent:18,paydayWeekday:4,lagWeeks:1,savingsGoal:1000,savingsName:'My savings goal',saved:0,history:[]};
const parse=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:fallback}catch{return fallback}};
let settings={...defaults,...parse(STORE,{})};if(!Array.isArray(settings.history))settings.history=[];
const money=n=>(Number(n)||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const asDate=s=>new Date(s+'T12:00:00');
const weekdayStart=(s,day)=>{const d=asDate(s);d.setDate(d.getDate()-(d.getDay()-day+7)%7);return dateISO(d)};
const plusDays=(s,n)=>{const d=asDate(s);d.setDate(d.getDate()+n);return dateISO(d)};
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const hours=c=>Math.max(0,((minutes(c.out)-minutes(c.in)+1440)%1440-Number(c.break||0))/60);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){localStorage.setItem(STORE,JSON.stringify(settings))}
function weeks(){
 const p=window.LifeHubTimecard.paySettings(parse(PAY,{}));
 const cards=parse(TC,{}),groups=new Map();
 for(const [date,c] of Object.entries(cards)){
  if(!/^\d{4}-\d\d-\d\d$/.test(date)||!c?.in||!c?.out)continue;
  const w=weekdayStart(date,Number(p.weekday)),h=hours(c),diff=Math.min(h,Math.max(0,Number(c.diff)||0));
  const g=groups.get(w)||{start:w,hours:0,diff:0,shifts:0};
  g.hours+=h;g.diff+=diff;g.shifts++;groups.set(w,g);
 }
 return [...groups.values()].sort((a,b)=>b.start.localeCompare(a.start)).map(g=>{
  const regular=Math.min(g.hours,Number(p.threshold)),ot=Math.max(0,g.hours-Number(p.threshold));
  const gross=regular*Number(p.rate)+ot*Number(p.rate)*Number(p.multiplier)+g.diff*Number(p.differential);
  const deduction=gross*(Number(settings.deductionPercent)||0)/100;
  return {...g,regular,ot,gross,deduction,net:gross-deduction,payday:plusDays(g.start,7*Number(settings.lagWeeks)+(Number(settings.paydayWeekday)-Number(p.weekday)+7)%7)};
 });
}
function render(){
 const all=weeks(),now=dateISO(new Date()),future=all.filter(w=>w.payday>=now).sort((a,b)=>a.payday.localeCompare(b.payday)),next=future[0]||null;
 const gross=all.reduce((n,w)=>n+w.gross,0),net=all.reduce((n,w)=>n+w.net,0),hoursTotal=all.reduce((n,w)=>n+w.hours,0);
 const ytd=all.filter(w=>w.start.slice(0,4)===now.slice(0,4)).reduce((n,w)=>n+w.gross,0);const daysToPay=next?Math.round((asDate(next.payday)-asDate(now))/86400000):null;
 $('pcSummary').innerHTML='<div class="stat"><strong>'+money(next?.gross||0)+'</strong><span>Next estimated gross'+(next?' · '+next.payday+' ('+daysToPay+' days)':' · no upcoming logged period')+'</span></div><div class="stat"><strong>'+money(next?.net||0)+'</strong><span>Next estimated take-home</span></div><div class="stat"><strong>'+money(ytd)+'</strong><span>Recorded '+now.slice(0,4)+' estimated gross</span></div><div class="stat"><strong>'+hoursTotal.toFixed(2)+' hrs</strong><span>All logged actual hours</span></div>';
 $('pcWeeks').innerHTML=all.length?all.map(w=>'<div class="command-entry" style="padding:12px;border-bottom:1px solid #ffffff24"><strong>Workweek '+w.start+' to '+plusDays(w.start,6)+'</strong><small style="display:block">'+w.hours.toFixed(2)+' actual hrs · '+w.ot.toFixed(2)+' OT hrs · '+w.diff.toFixed(2)+' differential hrs · '+w.shifts+' shifts</small><small style="display:block">Estimated gross '+money(w.gross)+' · deductions '+money(w.deduction)+' · take-home '+money(w.net)+'</small><small style="display:block">Projected payday '+w.payday+' (unconfirmed)</small></div>').join(''):'<p class="note">Add actual hours in Timecard to see paycheck estimates.</p>';
 $('pcHistory').innerHTML=settings.history.length?settings.history.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(h=>'<div class="command-entry" style="padding:10px;border-bottom:1px solid #ffffff24"><strong>'+safe(h.date)+' · Deposit '+money(h.net)+'</strong><small style="display:block">Gross '+money(h.gross)+(h.week?' · Workweek '+safe(h.week):'')+(h.note?' · '+safe(h.note):'')+'</small>'+(h.week&&all.find(w=>w.start===h.week)?'<small style="display:block">Versus estimate: '+money(h.net-all.find(w=>w.start===h.week).net)+' take-home difference</small>':'')+'<button type="button" data-pc-delete="'+safe(h.id)+'">Delete</button></div>').join(''):'<p class="note">No paychecks recorded yet. Add your first deposit when it arrives.</p>';
 const goal=Math.max(1,Number(settings.savingsGoal)||1),saved=Math.max(0,Number(settings.saved)||0);
 $('pcSavingsTitle').textContent=settings.savingsName||'My savings goal';
 $('pcSavingsProgress').textContent=money(saved)+' saved toward '+money(goal)+' ('+Math.min(100,100*saved/goal).toFixed(1)+'%)';
 $('pcSavingsBar').value=Math.min(goal,saved);$('pcSavingsBar').max=goal;
 $('pcDeduction').value=settings.deductionPercent;$('pcLag').value=settings.lagWeeks;$('pcPayday').value=settings.paydayWeekday;
 $('pcGoalName').value=settings.savingsName;$('pcGoal').value=settings.savingsGoal;
 $('pcNote').textContent='Payday dates assume the selected payday and lag; confirm with HERTZ. '+settings.deductionPercent+'% is your editable illustrative deduction rate, not a tax calculation. Differential overtime premiums, benefits, and employer withholding are not modeled.';
}
$('pcSettings').addEventListener('submit',e=>{e.preventDefault();const d=Number($('pcDeduction').value),lag=Number($('pcLag').value);if(d<0||d>80||!Number.isInteger(lag)||lag<0||lag>6)return;settings.deductionPercent=d;settings.lagWeeks=lag;settings.paydayWeekday=Number($('pcPayday').value);save();render()});
$('pcHistoryForm').addEventListener('submit',e=>{e.preventDefault();const date=$('pcDepositDate').value,gross=Number($('pcActualGross').value),net=Number($('pcActualNet').value);if(!date||gross<0||net<0)return;settings.history.push({id:String(Date.now())+Math.random().toString(36).slice(2),date,gross,net,week:$('pcWorkweek').value,note:$('pcDepositNote').value.trim()});save();$('pcHistoryForm').reset();render()});
$('pcHistory').addEventListener('click',e=>{const id=e.target.closest('button')?.dataset.pcDelete;if(!id)return;if(!confirm('Delete this paycheck history entry?'))return;settings.history=settings.history.filter(h=>h.id!==id);save();render()});
$('pcSavingsForm').addEventListener('submit',e=>{e.preventDefault();settings.savingsName=$('pcGoalName').value.trim()||'My savings goal';settings.savingsGoal=Number($('pcGoal').value);save();render()});
$('pcAddSavings').addEventListener('click',()=>{const n=Number($('pcSavingAmount').value);if(!Number.isFinite(n)||n<=0)return;settings.saved=Math.round(((Number(settings.saved)||0)+n)*100)/100;$('pcSavingAmount').value='';save();render()});
$('pcUndoSavings').addEventListener('click',()=>{const n=Number($('pcSavingAmount').value);if(!Number.isFinite(n)||n<=0)return;settings.saved=Math.max(0,Math.round(((Number(settings.saved)||0)-n)*100)/100);$('pcSavingAmount').value='';save();render()});
$('paycheckShortcut').addEventListener('click',()=>{const panel=$('paycheckPanel');panel.classList.remove('hidden');render();panel.scrollIntoView({behavior:'smooth',block:'start'})});
$('paycheckClose').addEventListener('click',()=>$('paycheckPanel').classList.add('hidden'));
window.addEventListener('storage',e=>{if([TC,PAY,STORE].includes(e.key)){settings={...defaults,...parse(STORE,{})};render()}});
render();
})();
