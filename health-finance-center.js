(()=>{'use strict';
const home=document.getElementById('phoneHome'),frame=home?.querySelector('.phone-frame');
if(!home||!frame)return;
const grid=home.querySelector('.phone-app[data-app="wellness"]')?.parentElement;
const tile=document.createElement('button');tile.type='button';tile.className='phone-app';tile.dataset.app='healthfinance';tile.innerHTML='<span class="phone-icon" style="background:linear-gradient(135deg,#7c274d,#31243b)">🩺</span><span>Health & Finances</span>';
if(grid)grid.insertBefore(tile,grid.querySelector('[data-app="money"]')||null);
const panel=document.createElement('section');panel.id='healthFinanceCenter';panel.hidden=true;panel.setAttribute('aria-label','Health and finances center');
panel.innerHTML=`<div class="hf-heading"><h3>🩺 Health & 💳 Finances</h3><button type="button" id="hfClose">✕ Close</button></div>
<p class="hf-note">Your personal launchpad. Medical records and banking details stay with their providers, not on this public website.</p>
<div class="hf-columns"><section class="hf-card"><h4>🩺 My Health</h4><p>UT Southwestern MyChart: appointments, lab results, medication list, messages and refills.</p><a class="hf-link" href="https://mychart.utsouthwestern.edu/" target="_blank" rel="noopener noreferrer">Open UT Southwestern MyChart ↗</a><h5>Diabetes</h5><p>Review glucose readings, A1C, and questions for your care team in MyChart.</p><h5>Kidney transplant follow-up</h5><p>Review transplant labs, medication instructions, and follow-up visits with your transplant team.</p><p class="hf-small">Keep taking prescribed medications as directed. This page does not interpret results or provide medical alerts.</p></section>
<section class="hf-card"><h4>💳 My Finances</h4><p>Open your financial institutions securely to check current balances, recent payments, and due dates.</p><div class="hf-links"><a class="hf-link" href="https://www.bankofamerica.com/" target="_blank" rel="noopener noreferrer">Bank of America ↗</a><a class="hf-link" href="https://www.capitalone.com/" target="_blank" rel="noopener noreferrer">Capital One ↗</a><a class="hf-link" href="https://www.citi.com/" target="_blank" rel="noopener noreferrer">Citi ↗</a></div><p class="hf-small">Balances are not synced to this website. For an account overview from your connected accounts, use ChatGPT Finances.</p></section></div>`;
frame.appendChild(panel);
const style=document.createElement('style');style.textContent=`
#healthFinanceCenter{margin:16px 0;padding:16px;background:#211b29;border:1px solid #94627e;border-radius:16px;color:#f8f3f7}
#healthFinanceCenter[hidden]{display:none!important}
.hf-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.hf-heading h3{margin:0;font-size:21px}
.hf-note,.hf-small{color:#d6c7d2;font-size:13px;line-height:1.55}.hf-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px;margin-top:14px}
.hf-card{border:1px solid #6d4d65;border-radius:14px;padding:15px;background:#2b2534}.hf-card h4{font-size:19px;margin:0 0 10px}.hf-card h5{font-size:15px;margin:16px 0 4px}.hf-card p{line-height:1.5}.hf-links{display:grid;gap:9px}
.hf-link{display:block;padding:11px 12px;border-radius:9px;border:1px solid #b57a99;background:#62324e;color:white!important;text-decoration:none;font-weight:700}.hf-link:hover,.hf-link:focus-visible{background:#8a4167}
`;document.head.appendChild(style);
function open(){document.getElementById('lifeSuitePanel')?.classList.add('hidden');panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'})}
tile.addEventListener('click',e=>{e.stopPropagation();open()});
panel.querySelector('#hfClose').addEventListener('click',()=>{panel.hidden=true;home.scrollIntoView({behavior:'smooth',block:'start'})});
window.openHealthFinanceCenter=open;
})();