(function(){
'use strict';
const $=id=>document.getElementById(id);
const todayISO=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};
const safe=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=$('myDayPanel');if(!panel)return;
const style=document.createElement('style');style.textContent=`
#lifeHubWelcome{background:linear-gradient(115deg,#412339,#22232c);border:1px solid #815670;border-radius:14px;padding:19px;margin:0 0 15px}
#lifeHubWelcome h2{margin:0 0 5px;font-size:clamp(21px,3vw,29px)}
#lifeHubWelcome p{margin:5px 0;color:#dfced9}
.life-quick{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0 3px}
.life-quick button,.life-quick a{display:inline-flex;align-items:center;text-decoration:none;background:#3b3342;color:#fff;border:1px solid #786476;border-radius:9px;padding:10px 12px;font-weight:650;min-height:44px}
.life-quick button:hover,.life-quick a:hover{background:#65445c}
.life-extra{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px;margin:14px 0}
.life-extra article{border:1px solid #67546a;background:#24232d;border-radius:13px;padding:16px}
.life-extra h3{margin:0 0 10px}.life-extra strong{font-size:22px}.life-extra p{color:#ded7df;line-height:1.5}
.life-extra button{margin-top:5px}
`;document.head.appendChild(style);
const welcome=document.createElement('div');welcome.id='lifeHubWelcome';welcome.innerHTML='<h2 id="lifeHubGreeting">Welcome home, Nico 🩵</h2><p>Your day, your priorities, all in one place.</p><div class="life-quick"><button type="button" data-life-action="add">＋ Add event</button><button type="button" data-life-action="timecard">🕒 Log hours</button><button type="button" data-life-action="paycheck">💵 Paycheck</button><button type="button" data-life-action="bills">🧾 Bills</button><button type="button" data-life-action="college">🎓 College</button><a href="https://nico-quiet-storm-journal.ptbeta.chatgpt.site" target="_blank" rel="noopener noreferrer">📓 Jacobi Journal</a></div>';
panel.insertBefore(welcome,panel.firstChild);
const extra=document.createElement('div');extra.className='life-extra';extra.id='lifeHubExtras';extra.setAttribute('aria-label','Daily overview');const cards=panel.querySelector('.my-day-cards');if(cards)cards.insertAdjacentElement('afterend',extra);
function openSection(id){const b=$(id);if(b)b.click()}
welcome.addEventListener('click',e=>{const a=e.target.closest('[data-life-action]');if(!a)return;const action=a.dataset.lifeAction;if(action==='add')openSection('addBtn');if(action==='timecard')openSection('timecardShortcut');if(action==='paycheck')openSection('paycheckShortcut');if(action==='bills')openSection('billsShortcut');if(action==='college')document.querySelector('[data-dashboard="college"]')?.click()});
function render(){
const h=new Date().getHours();$('lifeHubGreeting').textContent=(h<12?'☀️ Good morning':h<17?'🌤️ Good afternoon':'🌙 Good evening')+', Nico 🩵';
const model=window.LifeHubTimecard,now=todayISO(),pay=model.paySettings(read('nico-hertz-pay-v1',{}));
const actual=model.summarize({timecards:read('nico-hertz-timecards-v1',{}),manualHours:read('nico-planning-tools-v1',{}).hours,settings:pay,selectedWeek:model.weekStart(now,pay.weekday),today:now}),week=actual.weekly.hours,gross=actual.weekly.gross;
const upcoming=$('myDayUpcoming')?.querySelectorAll('.item').length||0;
const today=$('myDayToday')?.querySelectorAll('.item').length||0;
extra.innerHTML='<article><h3>🎯 Today at a glance</h3><strong>'+today+' calendar item'+(today===1?'':'s')+'</strong><p>'+upcoming+' upcoming event'+(upcoming===1?'':'s')+' shown in your calendar overview.</p><button type="button" data-extra="calendar">📅 View calendar</button></article>'+
'<article><h3>🚗 Hertz hours</h3><strong>'+week.toFixed(2)+' hrs</strong><p>Saved actual hours this payroll week. Estimated gross $'+gross.toFixed(2)+' includes configured overtime and differential, before deductions.</p><button type="button" data-extra="timecard">🕒 Open timecard</button></article>'+
'<article><h3>💵 Money & bills</h3><p>Check paycheck estimates and upcoming bills. Amounts are not live bank balances.</p><button type="button" data-extra="paycheck">💵 Paycheck</button> <button type="button" data-extra="bills">🧾 Bills</button></article>'+
'<article><h3>📓 Take a moment</h3><p>A quick reflection can help you close out the day. Your journal opens in its own site.</p><a class="button" href="https://nico-quiet-storm-journal.ptbeta.chatgpt.site" target="_blank" rel="noopener noreferrer">Open Jacobi Journal</a></article>';
}
extra.addEventListener('click',e=>{const b=e.target.closest('[data-extra]');if(!b)return;const a=b.dataset.extra;if(a==='calendar')$('myDayPanel')?.scrollIntoView({behavior:'smooth'});if(a==='timecard')openSection('timecardShortcut');if(a==='paycheck')openSection('paycheckShortcut');if(a==='bills')openSection('billsShortcut')});
render();window.addEventListener('storage',render);window.addEventListener('lifehub:hours-changed',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});panel.addEventListener('click',()=>setTimeout(render,120),{passive:true});
})();
