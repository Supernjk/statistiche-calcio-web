"use strict";
const trend={index:null,event:null};
const colors=[
  '#0072B2','#D55E00','#009E73','#CC79A7','#E69F00','#6F4E7C',
  '#1B9E77','#E41A1C','#377EB8','#984EA3','#A65628','#F781BF',
  '#4D4D4D','#00838F','#C62828','#2E7D32','#4527A0','#AD1457'
],colorByBook=new Map(),indexByBook=new Map();

function bookIndex(book){
  if(!indexByBook.has(book))indexByBook.set(book,indexByBook.size);
  return indexByBook.get(book);
}

function seriesColor(book){
  if(!colorByBook.has(book)){
    colorByBook.set(book,colors[bookIndex(book)%colors.length]);
  }
  return colorByBook.get(book);
}
function directionLabel(v){return v==='SALITA'?'In rialzo':v==='DISCESA'?'In ribasso':'Invariata'}
function directionClass(v){return v==='SALITA'?'up':v==='DISCESA'?'down':'flat'}
function points(s){const out=[];s.punti.forEach(p=>{const a=Date.parse(p.da_utc),b=Date.parse(p.a_utc);if(Number.isFinite(a))out.push({t:a,q:Number(p.quota)});if(Number.isFinite(b))out.push({t:b,q:Number(p.quota)})});return out.sort((a,b)=>a.t-b.t)}
function fillBooks(values){const el=$('#book'),v=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'it'));el.innerHTML=`<summary>Tutti gli operatori</summary><div class="multi-panel"><div class="multi-actions"><button type="button" data-all>Tutti</button><button type="button" data-none>Nessuno</button></div>${v.map(x=>`<label class="multi-option"><input type="checkbox" value="${esc(x)}" checked> ${esc(x)}</label>`).join('')}</div>`;const boxes=()=>[...el.querySelectorAll('input')],update=()=>{const n=boxes().filter(x=>x.checked);el.querySelector('summary').textContent=n.length===v.length?'Tutti gli operatori':n.length===0?'Nessun operatore':n.length===1?n[0].value:`${n.length} operatori`;draw()};el.querySelector('[data-all]').onclick=()=>{boxes().forEach(x=>x.checked=true);update()};el.querySelector('[data-none]').onclick=()=>{boxes().forEach(x=>x.checked=false);update()};boxes().forEach(x=>x.addEventListener('change',update))}
const dataFormatter=new Intl.DateTimeFormat('it-IT',{
  timeZone:'Europe/Rome',weekday:'long',day:'2-digit',month:'long',year:'numeric'
});

function eventDateKey(evento){
  const data=new Date(evento.kickoff_utc);
  if(!Number.isFinite(data.getTime()))return'';
  const parti=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(data);
  const valori=Object.fromEntries(parti.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${valori.year}-${valori.month}-${valori.day}`;
}

function eventDateLabel(evento){
  const data=new Date(evento.kickoff_utc);
  if(!Number.isFinite(data.getTime()))return'Data non disponibile';
  const testo=dataFormatter.format(data);
  return testo.charAt(0).toUpperCase()+testo.slice(1);
}

function eventTeams(evento){
  if(evento.casa&&evento.trasferta)return[evento.casa,evento.trasferta];
  const parti=String(evento.partita||'').split(' - ').map(v=>v.trim()).filter(Boolean);
  return parti.length>=2?[parti[0],parti.slice(1).join(' - ')]:parti;
}

function fillDateSelect(eventi){
  const select=$('#eventDate'),precedente=select.value,date=new Map();
  eventi.forEach(evento=>{
    const chiave=eventDateKey(evento);
    if(chiave&&!date.has(chiave))date.set(chiave,eventDateLabel(evento));
  });
  const ordinate=[...date.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  select.innerHTML='<option value="">Tutte le date</option>'+ordinate.map(([v,e])=>`<option value="${esc(v)}">${esc(e)}</option>`).join('');
  if(ordinate.some(([v])=>v===precedente))select.value=precedente;
}

function refreshEventFilters(reset=false){
  const campionato=$('#competition').value;
  const eventi=trend.index.eventi.filter(e=>!campionato||e.campionato===campionato);
  if(reset){$('#eventDate').value='';$('#team').value=''}
  fillDateSelect(eventi);
  fillSelect($('#team'),eventi.flatMap(eventTeams),'Tutte le squadre');
  filterEvents();
}

function filterEvents(){
  const ricerca=normalizedText($('#eventSearch').value),campionato=$('#competition').value;
  const data=$('#eventDate').value,squadra=$('#team').value;
  const lista=trend.index.eventi.filter(evento=>{
    const squadre=eventTeams(evento);
    return(!campionato||evento.campionato===campionato)&&
      (!data||eventDateKey(evento)===data)&&
      (!squadra||squadre.includes(squadra))&&
      (!ricerca||normalizedText(`${evento.partita} ${evento.campionato} ${squadre.join(' ')}`).includes(ricerca));
  });
  const select=$('#event'),precedente=select.value;
  select.innerHTML=lista.length?lista.map(e=>`<option value="${e.id}">${esc(e.partita)} \u00b7 ${esc(e.campionato)} \u00b7 ${fmtDate(e.kickoff_utc)}</option>`).join(''):'<option value="">Nessun evento trovato</option>';
  if(lista.some(e=>String(e.id)===precedente))select.value=precedente;
  $('#eventCount').textContent=`${lista.length.toLocaleString('it-IT')} eventi`;
  if(select.value)loadEvent(select.value);
  else{$('#eventPanel').classList.add('hidden');$('#view').className='empty';$('#view').textContent='Nessun evento con i filtri selezionati.'}
}
async function loadEvent(id){const meta=trend.index.eventi.find(e=>String(e.id)===String(id));if(!meta)return;$('#view').className='loading';$('#view').textContent='Caricamento andamento…';$('#view').classList.remove('hidden');try{trend.event=await loadJson(`${DATA_BASE_URL}/andamento/${meta.file}`);const e=trend.event.evento;$('#eventTitle').textContent=e.partita;$('#eventMeta').textContent=`${e.campionato} · ${fmtDate(e.kickoff_utc)}`;$('#cutoff').textContent=`Rilevazioni fino a ${fmtDate(e.fine_rilevazione_utc)}`;$('#seriesCount').textContent=`${trend.event.numero_serie_significative.toLocaleString('it-IT')} serie significative`;fillMarketSelect($('#market'),trend.event.serie.map(s=>s.mercato));$('#market').value=trend.event.serie.some(s=>s.mercato==='MATCH_RESULT')?'MATCH_RESULT':$('#market').options[1]?.value||'';dependent(true);$('#eventPanel').classList.remove('hidden');$('#view').classList.add('hidden')}catch(e){$('#eventPanel').classList.add('hidden');$('#view').className='error';$('#view').textContent=`Impossibile caricare la partita: ${e.message}`}}
function dependent(reset=false){const m=$('#market').value,base=trend.event.serie.filter(s=>!m||s.mercato===m);fillSelect($('#outcome'),base.map(s=>s.esito),'Tutti gli esiti');if(reset&&base.some(s=>s.esito==='1'))$('#outcome').value='1';fillSelect($('#line'),base.map(s=>s.linea),'Tutte le linee');fillBooks(base.map(s=>s.bookmaker));draw()}
function selected(){if(!trend.event)return[];const m=$('#market').value,o=$('#outcome').value,l=$('#line').value,t=$('#quoteType').value,minor=$('#minor').checked,b=multiValues($('#book'));return trend.event.serie.filter(s=>(minor||s.significativa)&&b.has(s.bookmaker)&&(!m||s.mercato===m)&&(!o||s.esito===o)&&(!l||s.linea===l)&&(!t||s.tipo_quota===t))}
function pointSvg(serie,indice,x,y,colore){
  const forma=bookIndex(serie.bookmaker)%4;
  const banca=serie.tipo_quota==='BANCA';
  const riempimento=banca?'#ffffff':colore;
  const comune=`data-series-index="${indice}" class="chart-point" fill="${riempimento}" stroke="${colore}" stroke-width="2"`;

  if(forma===1){
    return `<rect x="${x-6}" y="${y-6}" width="12" height="12" rx="1" ${comune}/>`;
  }
  if(forma===2){
    return `<polygon points="${x},${y-7} ${x+6.5},${y+6} ${x-6.5},${y+6}" ${comune}/>`;
  }
  if(forma===3){
    return `<polygon points="${x},${y-7} ${x+7},${y} ${x},${y+7} ${x-7},${y}" ${comune}/>`;
  }
  return `<circle cx="${x}" cy="${y}" r="6" ${comune}/>`;
}

function legendPointSvg(serie,colore){
  const forma=bookIndex(serie.bookmaker)%4;
  const banca=serie.tipo_quota==='BANCA';
  const riempimento=banca?'#ffffff':colore;
  const comune=`fill="${riempimento}" stroke="${colore}" stroke-width="2"`;

  if(forma===1)return `<rect x="35" y="5" width="8" height="8" rx="1" ${comune}/>`;
  if(forma===2)return `<polygon points="39,4 44,13 34,13" ${comune}/>`;
  if(forma===3)return `<polygon points="39,3 45,9 39,15 33,9" ${comune}/>`;
  return `<circle cx="39" cy="9" r="4" ${comune}/>`;
}

function evidenziaSerie(indice){
  const grafico=$('#chart');
  grafico.querySelectorAll('[data-series-index]').forEach(elemento=>{
    const attivo=Number(elemento.dataset.seriesIndex)===indice;
    elemento.style.opacity=attivo?'1':'0.08';
    if(elemento.classList.contains('series-line')){
      elemento.style.strokeWidth=attivo?'7':elemento.dataset.baseWidth;
    }
  });

  $('#legend').querySelectorAll('[data-legend-index]').forEach(elemento=>{
    elemento.classList.toggle(
      'series-muted',
      Number(elemento.dataset.legendIndex)!==indice
    );
  });
}

function ripristinaSerie(){
  const grafico=$('#chart');
  grafico.querySelectorAll('[data-series-index]').forEach(elemento=>{
    elemento.style.opacity='1';
    if(elemento.classList.contains('series-line')){
      elemento.style.strokeWidth=elemento.dataset.baseWidth;
    }
  });
  $('#legend').querySelectorAll('[data-legend-index]').forEach(elemento=>{
    elemento.classList.remove('series-muted');
  });
}

function collegaLegenda(){
  $('#legend').querySelectorAll('[data-legend-index]').forEach(elemento=>{
    const indice=Number(elemento.dataset.legendIndex);
    elemento.addEventListener('mouseenter',()=>evidenziaSerie(indice));
    elemento.addEventListener('mouseleave',ripristinaSerie);
    elemento.addEventListener('focus',()=>evidenziaSerie(indice));
    elemento.addEventListener('blur',ripristinaSerie);
  });
}


function initTrendViews(){
  if($('#showHeatmap').dataset.ready)return;
  $('#showHeatmap').dataset.ready='1';
  $('#showHeatmap').addEventListener('click',()=>{trend.viewMode='map';applyTrendViewMode()});
  $('#showLines').addEventListener('click',()=>{trend.viewMode='lines';applyTrendViewMode()});
  $('#showMovements').addEventListener('click',()=>{trend.viewMode='movements';applyTrendViewMode()});
}

function applyTrendViewMode(){
  const modo=trend.viewMode||'map';
  const mappa=modo==='map',linee=modo==='lines',movimenti=modo==='movements';
  $('#heatmapWrap').classList.toggle('hidden',!mappa);
  $('#chartWrap').classList.toggle('hidden',!linee);
  $('#legend').classList.toggle('hidden',!linee);
  $('#focusAdvice').classList.toggle('hidden',!linee);
  $('#movementView').classList.toggle('hidden',!movimenti);
  $('#showHeatmap').classList.toggle('active',mappa);
  $('#showLines').classList.toggle('active',linee);
  $('#showMovements').classList.toggle('active',movimenti);
}

function heatmapTime(value){
  return new Date(value).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function heatmapQuoteAt(serie,tempo){
  const punti=[...serie.punti].sort((a,b)=>Date.parse(a.da_utc)-Date.parse(b.da_utc));
  let trovato=null;
  for(const punto of punti){
    const inizio=Date.parse(punto.da_utc);
    if(Number.isFinite(inizio)&&inizio<=tempo)trovato=Number(punto.quota);
    if(Number.isFinite(inizio)&&inizio>tempo)break;
  }
  return Number.isFinite(trovato)?trovato:null;
}

function renderHeatmap(series,minT,maxT){
  const contenitore=$('#heatmapWrap');
  const tempi=[...new Set(series.flatMap(s=>s.punti.map(p=>Date.parse(p.da_utc)))
    .filter(t=>Number.isFinite(t)&&t>=minT&&t<=maxT))].sort((a,b)=>a-b);

  if(!tempi.length){
    contenitore.innerHTML='<div class="empty">Nessuna rilevazione disponibile per la mappa.</div>';
    return;
  }

  const ordinate=[...series].sort((a,b)=>
    `${a.bookmaker} ${a.tipo_quota}`.localeCompare(`${b.bookmaker} ${b.tipo_quota}`,'it')
  );

  const intestazione=tempi.map(t=>`<th>${heatmapTime(t)}</th>`).join('');
  const righe=ordinate.map(s=>{
    let precedente=null;
    const celle=tempi.map(t=>{
      const quota=heatmapQuoteAt(s,t);
      if(quota===null)return '<td class="heat-empty">—</td>';
      let classe='heat-stable',simbolo='';
      if(precedente!==null&&quota>precedente){classe='heat-up';simbolo=' ▲'}
      else if(precedente!==null&&quota<precedente){classe='heat-down';simbolo=' ▼'}
      const descrizione=`${s.bookmaker} · ${s.tipo_quota} · ${heatmapTime(t)} · quota ${fmtNumber(quota,3)}`;
      precedente=quota;
      return `<td class="${classe}" title="${esc(descrizione)}"><strong>${fmtNumber(quota,3)}</strong>${simbolo}</td>`;
    }).join('');
    return `<tr><th class="heat-series"><strong>${esc(s.bookmaker)}</strong><small>${esc(s.tipo_quota)} · ${esc(s.esito)} ${esc(s.linea)}</small></th>${celle}</tr>`;
  }).join('');

  contenitore.innerHTML=`<div class="heatmap-heading"><strong>Mappa generale · ${ordinate.length.toLocaleString('it-IT')} serie</strong><span>Scorri orizzontalmente per seguire il tempo →</span></div><div class="heatmap-scroller"><table class="heatmap-table"><thead><tr><th class="heat-series">Operatore</th>${intestazione}</tr></thead><tbody>${righe}</tbody></table></div><div class="heatmap-legend"><span><i class="heat-stable"></i>Invariata</span><span><i class="heat-up"></i>In aumento</span><span><i class="heat-down"></i>In diminuzione</span></div>`;
}

function draw(){
  if(!trend.event)return;

  let series=selected();
  const chart=$('#chart');

  if(!series.length){
    chart.className='empty';
    chart.textContent='Nessuna serie con i filtri selezionati.';
    $('#legend').innerHTML='';
    $('#heatmapWrap').innerHTML='';
    $('#movementTable').innerHTML='';
    summary([]);
    return;
  }

  let all=series.flatMap(s=>points(s).map(p=>({...p,s})));
  const maxT=Math.max(...all.map(p=>p.t));
  let minT=Math.min(...all.map(p=>p.t));

  if($('#window').value!=='all'){
    minT=Math.max(minT,maxT-Number($('#window').value)*3600000);
  }

  series=series
    .map(s=>({...s,_p:points(s).filter(p=>p.t>=minT&&p.t<=maxT)}))
    .filter(s=>s._p.length);

  all=series.flatMap(s=>s._p.map(p=>({...p,s})));

  if(!all.length){
    chart.className='empty';
    chart.textContent='Nessun punto nell intervallo selezionato.';
    return;
  }

  const quote=all.map(p=>p.q);
  const minima=Math.min(...quote),massima=Math.max(...quote);
  const margine=Math.max((massima-minima)*.12,.03);
  const minQ=Math.max(1,minima-margine),maxQ=massima+margine;
  const W=1100,H=500,L=68,R=22,T=24,B=54;
  const x=v=>L+(v-minT)/(maxT-minT||1)*(W-L-R);
  const y=v=>T+(maxQ-v)/(maxQ-minQ||1)*(H-T-B);

  let svg=`<svg class="trend-svg" viewBox="0 0 ${W} ${H}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" class="chart-bg"/>`;

  for(let i=0;i<=5;i++){
    const q=minQ+(maxQ-minQ)*i/5,yy=y(q);
    const tempo=minT+(maxT-minT)*i/5,xx=x(tempo);
    svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="grid-line"/><text x="${L-9}" y="${yy+4}" text-anchor="end" class="axis-label">${fmtNumber(q,2)}</text><line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" class="grid-line vertical"/><text x="${xx}" y="${H-B+22}" text-anchor="middle" class="axis-label">${new Date(tempo).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</text>`;
  }

  series.forEach((s,indice)=>{
    let percorso=`M ${x(s._p[0].t)} ${y(s._p[0].q)}`;
    for(let i=1;i<s._p.length;i++){
      percorso+=` H ${x(s._p[i].t)} V ${y(s._p[i].q)}`;
    }

    const colore=seriesColor(s.bookmaker);
    const banca=s.tipo_quota==='BANCA';
    const spessore=banca?'3.4':'4.8';
    const tratteggio=banca?'5 7':'';

    svg+=`<path d="${percorso}" data-series-index="${indice}" data-base-width="${spessore}" class="series-line ${banca?'lay-line':''}" fill="none" stroke="${colore}" stroke-width="${spessore}" stroke-dasharray="${tratteggio}"/>`;

    s._p
      .filter((_,i)=>i%2===0)
      .forEach(p=>{
        svg+=pointSvg(s,indice,x(p.t),y(p.q),colore);
      });
  });

  svg+=`<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" class="hover-layer"/></svg>`;
  chart.className='';
  chart.innerHTML=svg;

  $('#legend').innerHTML=series.map((s,indice)=>{
    const colore=seriesColor(s.bookmaker);
    const banca=s.tipo_quota==='BANCA';
    const tratteggio=banca?'5 7':'';
    return `<button type="button" class="legend-item legend-interactive" data-legend-index="${indice}"><svg class="legend-sample" viewBox="0 0 48 18" aria-hidden="true"><line x1="2" y1="9" x2="46" y2="9" stroke="${colore}" stroke-width="${banca?'3.4':'4.8'}" stroke-dasharray="${tratteggio}"/>${legendPointSvg(s,colore)}</svg><span>${esc(s.bookmaker)} \u00b7 ${esc(s.esito)} \u00b7 ${esc(s.tipo_quota)}</span><b class="trend-badge ${directionClass(s.direzione)}">${directionLabel(s.direzione)} ${fmtNumber(s.quota_iniziale,2)} \u2192 ${fmtNumber(s.quota_finale,2)}</b></button>`;
  }).join('');

  renderHeatmap(series,minT,maxT);
  $('#focusAdvice').textContent=`${series.length} serie selezionate · consigliate massimo 5 nel grafico`;
  $('#focusAdvice').classList.toggle('too-many',series.length>8);
  applyTrendViewMode();
  collegaLegenda();
  summary(series);
  table(series);
  tooltip(chart.querySelector('.hover-layer'),series,{minT,maxT,L,R,W});
}
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
function movementTime(value){
  const data=new Date(value);
  if(!Number.isFinite(data.getTime()))return 'Orario non disponibile';
  return data.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function movementRows(series){
  return series.flatMap(s=>{
    const punti=[...s.punti].sort((a,b)=>Date.parse(a.da_utc)-Date.parse(b.da_utc));
    return punti.slice(1).map((p,indice)=>{
      const precedente=Number(punti[indice].quota),nuova=Number(p.quota);
      return {s,p,precedente,nuova,variazione:nuova-precedente,tempo:Date.parse(p.da_utc)};
    }).filter(r=>Number.isFinite(r.tempo)&&Number.isFinite(r.precedente)&&Number.isFinite(r.nuova)&&Math.abs(r.variazione)>1e-12);
  });
}
function table(series){
  const ordine=table.ordine==='asc'?'asc':'desc';
  const righe=movementRows(series)
    .sort((a,b)=>ordine==='asc'?a.tempo-b.tempo:b.tempo-a.tempo)
    .slice(0,500);
  const freccia=ordine==='asc'?'▲':'▼';
  const descrizione=ordine==='asc'?'piu vecchi prima':'piu recenti prima';
  const corpo=righe.length?righe.map(r=>{
    const classe=r.variazione>0?'up':'down';
    const segno=r.variazione>0?'+':'';
    return `<tr><td><strong class="movement-time">${movementTime(r.p.da_utc)}</strong></td><td>${esc(r.s.bookmaker)}</td><td>${esc(r.s.tipo_quota)}</td><td>${esc(marketLabel(r.s.mercato))}</td><td>${esc(r.s.esito)} ${esc(r.s.linea)}</td><td class="movement-old">${fmtNumber(r.precedente,3)}</td><td><strong class="movement-new">${fmtNumber(r.nuova,3)}</strong></td><td><strong class="movement-delta ${classe}">${segno}${fmtNumber(r.variazione,3)}</strong></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">Nessuna variazione reale con i filtri selezionati.</td></tr>';
  $('#movementTable').innerHTML=`<div class="movement-table-heading"><strong>${righe.length.toLocaleString('it-IT')} variazioni mostrate</strong><span>Massimo 500 movimenti</span></div><div class="table-wrap"><table class="data-table movement-table"><thead><tr><th><button type="button" id="movementSort" class="movement-sort" title="Inverti ordine cronologico">Orario variazione <span>${freccia}</span><small>${descrizione}</small></button></th><th>Operatore</th><th>Tipo</th><th>Mercato</th><th>Esito</th><th>Quota precedente</th><th>Nuova quota</th><th>Variazione</th></tr></thead><tbody>${corpo}</tbody></table></div>`;
  $('#movementSort').addEventListener('click',()=>{table.ordine=ordine==='desc'?'asc':'desc';table(series)});
}
function tooltip(layer,series,k){const tip=$('#tooltip');layer.addEventListener('mousemove',e=>{const rect=layer.ownerSVGElement.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*k.W,t=k.minT+(px-k.L)/(k.W-k.L-k.R)*(k.maxT-k.minT);if(px<k.L||px>k.W-k.R)return;const near=series.map(s=>({s,p:s._p.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,s._p[0])})).sort((a,b)=>Math.abs(a.p.t-t)-Math.abs(b.p.t-t)).slice(0,8);tip.classList.remove('hidden');tip.style.left=`${Math.min(e.offsetX+15,700)}px`;tip.style.top=`${Math.max(8,e.offsetY-25)}px`;tip.innerHTML=`<strong>${fmtDate(new Date(t).toISOString())}</strong>${near.map(({s,p})=>`<div><i style="background:${seriesColor(s.bookmaker)}"></i>${esc(s.bookmaker)} ${esc(s.tipo_quota)}: <b>${fmtNumber(p.q,3)}</b></div>`).join('')}`});layer.addEventListener('mouseleave',()=>tip.classList.add('hidden'))}
loadJson(`${DATA_BASE_URL}/andamento/indice.json`).then(i=>{
  trend.index=i;
  setUpdated(i.generato_utc);
  fillSelect($('#competition'),i.eventi.map(e=>e.campionato),'Tutti i campionati');
  $('#eventSearch').addEventListener('input',filterEvents);
  $('#competition').addEventListener('change',()=>refreshEventFilters(true));
  $('#eventDate').addEventListener('change',filterEvents);
  $('#team').addEventListener('change',filterEvents);
  $('#event').addEventListener('change',e=>loadEvent(e.target.value));
  $('#market').addEventListener('change',()=>dependent(true));
  ['outcome','line','quoteType','window','minor'].forEach(id=>$('#'+id).addEventListener('change',draw));
  trend.viewMode='map';
  initTrendViews();
  refreshEventFilters(true);
}).catch(errore=>{
  $('#view').className='error';
  $('#view').textContent=`Impossibile caricare l'indice: ${errore.message}`;
  setUpdated(null);
});