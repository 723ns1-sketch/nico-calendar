(()=>{'use strict';
function setup(){
 const panel=document.getElementById('healthFinanceCenter');
 if(!panel||panel.querySelector('#hfDemo'))return;
 const finance=panel.querySelector('.hf-card:nth-child(2)');
 if(!finance)return;
 const demo=document.createElement('div');demo.id='hfDemo';
 demo.innerHTML=`<div class="hf-demo-head"><div><h5>💳 Financial dashboard preview</h5><strong class="hf-demo-badge">DEMO · FICTIONAL DATA</strong></div><button id="hfDemoRefresh" type="button">↻ Refresh demo</button></div>
 <p class="hf-small">Sample balances only. No bank connection, no real account numbers, and no live synchronization.</p>
 <div class="hf-demo-summary"><div><small>Sample checking balance</small><strong id="hfDemoCash">$2,450.00</strong></div><div><small>Sample credit card debt</small><strong id="hfDemoDebt">$5,225.00</strong></div></div>
 <div class="hf-demo-accounts" id="hfDemoAccounts"></div>
 <p class="hf-small" id="hfDemoStatus" role="status">Sample data loaded. Refresh only redraws fictional figures.</p>`;
 finance.prepend(demo);
 const cards=[
  {name:'Bank of America',type:'Checking',last:'••0001',amount:2450},
  {name:'Capital One',type:'Credit card',last:'••0002',amount:1250},
  {name:'Capital One',type:'Credit card',last:'••0003',amount:790},
  {name:'Citi',type:'Credit card',last:'••0004',amount:3185}
 ];
 const money=v=>v.toLocaleString('en-US',{style:'currency',currency:'USD'});
 function draw(){
  demo.querySelector('#hfDemoCash').textContent=money(cards.filter(x=>x.type==='Checking').reduce((a,b)=>a+b.amount,0));
  demo.querySelector('#hfDemoDebt').textContent=money(cards.filter(x=>x.type==='Credit card').reduce((a,b)=>a+b.amount,0));
  demo.querySelector('#hfDemoAccounts').replaceChildren(...cards.map(c=>{
   const row=document.createElement('div');row.className='hf-demo-row';
   const label=document.createElement('span');label.textContent=c.name+' · '+c.type+' '+c.last;
   const value=document.createElement('strong');value.textContent=money(c.amount);
   row.append(label,value);return row;
  }));
 }
 draw();
 demo.querySelector('#hfDemoRefresh').addEventListener('click',()=>{
  draw();
  demo.querySelector('#hfDemoStatus').textContent='Demo refreshed at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'. These are still fictional balances, not bank updates.';
 });
 const style=document.createElement('style');style.textContent=`
 #hfDemo{margin:0 0 20px;padding:14px;border:1px solid #ad809a;border-radius:12px;background:#201c2b}
 .hf-demo-head{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}.hf-demo-head h5{margin:0 0 5px!important}
 .hf-demo-badge{font-size:11px;color:#fff;background:#87502a;border-radius:6px;padding:5px 8px;display:inline-block;letter-spacing:.03em}
 .hf-demo-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
 .hf-demo-summary>div{border:1px solid #695c70;background:#ffffff0b;border-radius:10px;padding:10px;min-width:0}
 .hf-demo-summary small,.hf-demo-summary strong{display:block}.hf-demo-summary small{font-size:11px;color:#ddcddd}
 .hf-demo-summary strong{font-size:clamp(16px,3.5vw,23px);margin-top:7px;overflow-wrap:anywhere}
 .hf-demo-row{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #5e5264;padding:10px 0;font-size:12px}
 .hf-demo-row strong{white-space:nowrap}.hf-demo-row span{overflow-wrap:anywhere}
 `;document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();