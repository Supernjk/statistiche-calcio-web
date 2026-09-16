"use strict";
const trend={index:null,event:null};
const colors=['#1769aa','#d9485f','#138a5b','#8a5cc2','#e07a1f','#087f8c','#9c6b00','#d23c95','#415a77','#70a11f','#784421','#5965d8'],colorByBook=new Map();
function seriesColor(book){if(!colorByBook.has(book))colorByBook.set(book,colors[colorByBook.size%colors.length]);return colorByBook.get(book)}
function directionLabel(v){return v==='SALITA'?'In rialzo':v==='DISCESA'?'In ribasso':'Invariata'}
function directionClass(v){return v==='SALITA'?'up':v==='DISCESA'?'down':'flat'}
function points(s){const out=[];s.punti.forEach(p=>{const a=Date.parse(p.da_utc),b=Date.parse(p.a_utc);if(Number.isFinite(a))out.push({t:a,q:Number(p.quota)});if(Number.isFinite(b))out.push({t:b,q:Number(p.quota)})});return out.sort((a,b)=>a.t-b.t)}
function fillBooks(values){const el=$('#book'),v=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'it'));el.innerHTML=`<summary>Tutti gli operatori</summary><div class="multi-panel"><div class="multi-actions"><button type="button" data-all>Tutti</button><button type="button" data-none>Nessuno</button></div>${v.map(x=>`<label class="multi-option"><input type="checkbox" value="${esc(x)}" checked> ${esc(x)}</label>`).join('')}</div>`;const boxes=()=>[...el.querySelectorAll('input')],update=()=>{const n=boxes().filter(x=>x.checked);el.querySelector('summary').textContent=n.length===v.length?'Tutti gli operatori':n.length===0?'Nessun operatore':n.length===1?n[0].value:`${n.length} operatori`;draw()};el.querySelector('[data-all]').onclick=()=>{boxes().forEach(x=>x.checked=true);update()};el.querySelector('[data-none]').onclick=()=>{boxes().forEach(x=>x.checked=false);update()};boxes().forEach(x=>x.addEventListener('change',update))}
function filterEvents(){const q=normalizedText($('#eventSearch').value),c=$('#competition').value,list=trend.index.eventi.filter(e=>(!c||e.campionato===c)&&(!q||normalizedText(`${e.partita} ${e.campionato}`).includes(q))),select=$('#event'),old=select.value;select.innerHTML=list.length?list.map(e=>`<option value="${e.id}">${esc(e.partita)} · ${esc(e.campionato)} · ${fmtDate(e.kickoff_utc)}</option>`).join(''):'<option value="">Nessun evento trovato</option>';if(list.some(e=>String(e.id)===old))select.value=old;$('#eventCount').textContent=`${list.length.toLocaleString('it-IT')} eventi`;if(select.value)loadEvent(select.value);else{$('#eventPanel').classList.add('hidden');$('#view').className='empty';$('#view').textContent='Nessun evento con i filtri selezionati.'}}
async function loadEvent(id){const meta=trend.index.eventi.find(e=>String(e.id)===String(id));if(!meta)return;$('#view').className='loading';$('#view').textContent='Caricamento andamento…';$('#view').classList.remove('hidden');try{trend.event=await loadJson(`${DATA_BASE_URL}/andamento/${meta.file}`);const e=trend.event.evento;$('#eventTitle').textContent=e.partita;$('#eventMeta').textContent=`${e.campionato} · ${fmtDate(e.kickoff_utc)}`;$('#cutoff').textContent=`Rilevazioni fino a ${fmtDate(e.fine_rilevazione_utc)}`;$('#seriesCount').textContent=`${trend.event.numero_serie_significative.toLocaleString('it-IT')} serie significative`;fillMarketSelect($('#market'),trend.event.serie.map(s=>s.mercato));$('#market').value=trend.event.serie.some(s=>s.mercato==='MATCH_RESULT')?'MATCH_RESULT':$('#market').options[1]?.value||'';dependent(true);$('#eventPanel').classList.remove('hidden');$('#view').classList.add('hidden')}catch(e){$('#eventPanel').classList.add('hidden');$('#view').className='error';$('#view').textContent=`Impossibile caricare la partita: ${e.message}`}}
function dependent(reset=false){const m=$('#market').value,base=trend.event.serie.filter(s=>!m||s.mercato===m);fillSelect($('#outcome'),base.map(s=>s.esito),'Tutti gli esiti');if(reset&&base.some(s=>s.esito==='1'))$('#outcome').value='1';fillSelect($('#line'),base.map(s=>s.linea),'Tutte le linee');fillBooks(base.map(s=>s.bookmaker));draw()}
function selected(){if(!trend.event)return[];const m=$('#market').value,o=$('#outcome').value,l=$('#line').value,t=$('#quoteType').value,minor=$('#minor').checked,b=multiValues($('#book'));return trend.event.serie.filter(s=>(minor||s.significativa)&&b.has(s.bookmaker)&&(!m||s.mercato===m)&&(!o||s.esito===o)&&(!l||s.linea===l)&&(!t||s.tipo_quota===t))}
function draw(){if(!trend.event)return;let series=selected(),chart=$('#chart');if(!series.length){chart.className='empty';chart.textContent='Nessuna serie con i filtri selezionati.';$('#legend').innerHTML='';$('#movementTable').innerHTML='';summary([]);return}let all=series.flatMap(s=>points(s).map(p=>({...p,s}))),maxT=Math.max(...all.map(p=>p.t)),minT=Math.min(...all.map(p=>p.t));if($('#window').value!=='all')minT=Math.max(minT,maxT-Number($('#window').value)*3600000);series=series.map(s=>({...s,_p:points(s).filter(p=>p.t>=minT&&p.t<=maxT)})).filter(s=>s._p.length);all=series.flatMap(s=>s._p.map(p=>({...p,s})));if(!all.length){chart.className='empty';chart.textContent='Nessun punto nell’intervallo selezionato.';return}const qs=all.map(p=>p.q),lo=Math.min(...qs),hi=Math.max(...qs),pad=Math.max((hi-lo)*.12,.03),minQ=Math.max(1,lo-pad),maxQ=hi+pad,W=1100,H=500,L=68,R=22,T=24,B=54,x=v=>L+(v-minT)/(maxT-minT||1)*(W-L-R),y=v=>T+(maxQ-v)/(maxQ-minQ||1)*(H-T-B);let svg=`<svg class="trend-svg" viewBox="0 0 ${W} ${H}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" class="chart-bg"/>`;for(let i=0;i<=5;i++){const q=minQ+(maxQ-minQ)*i/5,yy=y(q),tm=minT+(maxT-minT)*i/5,xx=x(tm);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="grid-line"/><text x="${L-9}" y="${yy+4}" text-anchor="end" class="axis-label">${fmtNumber(q,2)}</text><line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" class="grid-line vertical"/><text x="${xx}" y="${H-B+22}" text-anchor="middle" class="axis-label">${new Date(tm).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</text>`}series.forEach(s=>{let d=`M ${x(s._p[0].t)} ${y(s._p[0].q)}`;for(let i=1;i<s._p.length;i++)d+=` H ${x(s._p[i].t)} V ${y(s._p[i].q)}`;svg+=`<path d="${d}" class="series-line ${s.tipo_quota==='BANCA'?'lay-line':''}" style="stroke:${seriesColor(s.bookmaker)}"/>`;s._p.filter((_,i)=>i%2===0).forEach(p=>svg+=`<circle cx="${x(p.t)}" cy="${y(p.q)}" r="4" class="chart-point" style="fill:${seriesColor(s.bookmaker)}"/>`)});svg+=`<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" class="hover-layer"/></svg>`;chart.className='';chart.innerHTML=svg;$('#legend').innerHTML=series.map(s=>`<span class="legend-item"><i style="background:${seriesColor(s.bookmaker)}"></i>${esc(s.bookmaker)} · ${esc(s.esito)} · ${esc(s.tipo_quota)} <b class="trend-badge ${directionClass(s.direzione)}">${directionLabel(s.direzione)} ${fmtNumber(s.quota_iniziale,2)} → ${fmtNumber(s.quota_finale,2)}</b></span>`).join('');summary(series);table(series);tooltip(chart.querySelector('.hover-layer'),series,{minT,maxT,L,R,W})}
function summary(s){
    let rialzi=0;
    let ribassi=0;
    let inversioni=0;

    s.forEach(serie=>{
        const quote=serie.punti
            .slice()
            .sort((a,b)=>Date.parse(a.da_utc)-Date.parse(b.da_utc))
            .map(p=>Number(p.quota))
            .filter(Number.isFinite);

        let direzionePrecedente=0;

        for(let i=1;i<quote.length;i++){
            const direzione=
                quote[i]>quote[i-1] ? 1 :
                quote[i]<quote[i-1] ? -1 : 0;

            if(direzione===1) rialzi++;
            if(direzione===-1) ribassi++;

            if(
                direzione!==0 &&
                direzionePrecedente!==0 &&
                direzione!==direzionePrecedente
            ){
                inversioni++;
            }

            if(direzione!==0){
                direzionePrecedente=direzione;
            }
        }
    });

    const variazioni=rialzi+ribassi;

    $('#trendSummary').innerHTML=[
        ['Serie mostrate',s.length],
        ['Variazioni totali',variazioni],
        ['Rialzi effettivi',rialzi],
        ['Ribassi effettivi',ribassi],
        ['Cambi di direzione',inversioni]
    ].map(([a,b])=>
        `<div class="card"><span>${a}</span><strong>${Number(b).toLocaleString('it-IT')}</strong></div>`
    ).join('')
}
function table(series){const r=series.flatMap(s=>s.punti.map(p=>({s,p}))).sort((a,b)=>Date.parse(b.p.da_utc)-Date.parse(a.p.da_utc)).slice(0,500);$('#movementTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Operatore</th><th>Tipo</th><th>Mercato</th><th>Esito</th><th>Quota</th><th>Da</th><th>Fino a</th><th>Direzione</th></tr></thead><tbody>${r.map(({s,p})=>`<tr><td>${esc(s.bookmaker)}</td><td>${esc(s.tipo_quota)}</td><td>${esc(marketLabel(s.mercato))}</td><td>${esc(s.esito)} ${esc(s.linea)}</td><td><strong>${fmtNumber(p.quota,3)}</strong></td><td>${fmtDate(p.da_utc)}</td><td>${fmtDate(p.a_utc)}</td><td><span class="trend-badge ${directionClass(s.direzione)}">${directionLabel(s.direzione)}</span></td></tr>`).join('')}</tbody></table></div>`}
function tooltip(layer,series,k){const tip=$('#tooltip');layer.addEventListener('mousemove',e=>{const rect=layer.ownerSVGElement.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*k.W,t=k.minT+(px-k.L)/(k.W-k.L-k.R)*(k.maxT-k.minT);if(px<k.L||px>k.W-k.R)return;const near=series.map(s=>({s,p:s._p.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,s._p[0])})).sort((a,b)=>Math.abs(a.p.t-t)-Math.abs(b.p.t-t)).slice(0,8);tip.classList.remove('hidden');tip.style.left=`${Math.min(e.offsetX+15,700)}px`;tip.style.top=`${Math.max(8,e.offsetY-25)}px`;tip.innerHTML=`<strong>${fmtDate(new Date(t).toISOString())}</strong>${near.map(({s,p})=>`<div><i style="background:${seriesColor(s.bookmaker)}"></i>${esc(s.bookmaker)} ${esc(s.tipo_quota)}: <b>${fmtNumber(p.q,3)}</b></div>`).join('')}`});layer.addEventListener('mouseleave',()=>tip.classList.add('hidden'))}
loadJson(`${DATA_BASE_URL}/andamento/indice.json`).then(i=>{trend.index=i;setUpdated(i.generato_utc);fillSelect($('#competition'),i.eventi.map(e=>e.campionato),'Tutti i campionati');$('#eventSearch').addEventListener('input',filterEvents);$('#competition').addEventListener('change',filterEvents);$('#event').addEventListener('change',e=>loadEvent(e.target.value));$('#market').addEventListener('change',()=>dependent(true));['outcome','line','quoteType','window','minor'].forEach(id=>$('#'+id).addEventListener('change',draw));filterEvents()}).catch(e=>{$('#view').className='error';$('#view').textContent=`Impossibile caricare l’indice: ${e.message}`;setUpdated(null)});
