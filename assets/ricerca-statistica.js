"use strict";

const research={data:null,records:[],loaded:false,loading:false,initializing:false};

function researchMedian(values){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function researchAverage(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
function researchPercent(part,total){return total?`${fmtNumber(100*part/total,2)}%`:'0,00%'}
function researchSigned(value,digits=2){return`${value>0?'+':''}${fmtNumber(value,digits)}%`}
function researchDirection(value,threshold){return value>threshold?'up':value<-threshold?'down':'flat'}
function researchDirectionLabel(value,threshold){const direction=researchDirection(value,threshold);return direction==='up'?'Salita':direction==='down'?'Discesa':'Invariata'}

function decodeResearchData(data){
  const events=new Map(data.eventi||[]);
  return(data.record||[]).map(r=>({
    eventId:r[0],match:events.get(r[0])||`Evento ${r[0]}`,competition:data.campionati[r[1]],kickoff:r[2]*1000,
    bookmaker:data.bookmaker[r[3]],market:data.mercati[r[4]],line:data.linee[r[5]],
    outcome:data.esiti[r[6]],horizon:r[7],initial:r[8]/1000,final:r[9]/1000,
    finalMinutes:r[10],variation:100*(r[9]-r[8])/r[8]
  }));
}
function researchMarketLabel(value){return marketLabel(value)}
function exactSelect(el,values,labeler=value=>value){
  const unique=[...new Set(values)].sort((a,b)=>String(a).localeCompare(String(b),'it',{numeric:true}));
  el.innerHTML=unique.map(value=>`<option value="${esc(value)}">${esc(labeler(value))}</option>`).join('');
}
function fillResearchMulti(el,values,allLabel,noneLabel,itemLabel=value=>value,onChange=()=>{},selectedValues=null){
  const unique=[...new Set(values)].sort((a,b)=>String(a).localeCompare(String(b),'it',{numeric:true}));
  const selected=selectedValues===null?new Set(unique):selectedValues;
  el.innerHTML=`<summary>${esc(allLabel)}</summary><div class="multi-panel"><div class="multi-actions"><button type="button" data-all>Tutti</button><button type="button" data-none>Nessuno</button></div>${unique.map(value=>`<label class="multi-option"><input type="checkbox" value="${esc(value)}"${selected.has(value)?' checked':''}> ${esc(itemLabel(value))}</label>`).join('')}</div>`;
  const boxes=()=>[...el.querySelectorAll('input[type=checkbox]')];
  const update=()=>{const chosen=boxes().filter(x=>x.checked),label=chosen.length===unique.length?allLabel:chosen.length===0?noneLabel:chosen.length===1?itemLabel(chosen[0].value):`${chosen.length} selezionati`;el.querySelector('summary').textContent=label;onChange()};
  el.querySelector('[data-all]').onclick=()=>{boxes().forEach(x=>x.checked=true);update()};
  el.querySelector('[data-none]').onclick=()=>{boxes().forEach(x=>x.checked=false);update()};
  boxes().forEach(x=>x.addEventListener('change',update));update();
}
function updateResearchDependencies(reset=true){
  const wasInitializing=research.initializing;research.initializing=true;
  const markets=multiValues($('#researchMarket'));
  const base=research.records.filter(r=>markets.has(r.market));
  const previousLines=reset?null:multiValues($('#researchLine'));
  const previousOutcomes=reset?null:multiValues($('#researchOutcome'));
  fillResearchMulti($('#researchLine'),base.map(r=>r.line),'Tutte le linee','Nessuna linea selezionata',value=>value||'Nessuna linea',()=>{if(research.loaded&&!research.initializing)runResearch()},previousLines);
  fillResearchMulti($('#researchOutcome'),base.map(r=>r.outcome),'Tutti gli esiti','Nessun esito',value=>value,()=>{if(research.loaded&&!research.initializing)runResearch()},previousOutcomes);
  research.initializing=wasInitializing;
}

function initializeResearchControls(){
  const data=research.data;
  research.initializing=true;
  exactSelect($('#researchHorizon'),data.regole.orizzonti_ore,value=>value>=24?`${value/24} ${value===24?'giorno':'giorni'} prima`:`${value} ore prima`);
  $('#researchHorizon').value=data.regole.orizzonti_ore.includes(72)?'72':String(data.regole.orizzonti_ore[0]);
  fillResearchMulti($('#researchMarket'),data.mercati,'Tutti i mercati','Nessun mercato',researchMarketLabel,()=>{if(research.loaded&&!research.initializing){updateResearchDependencies(true);runResearch()}});
  fillResearchMulti($('#researchCompetition'),data.campionati,'Tutti i campionati','Nessun campionato',value=>value,()=>{if(research.loaded&&!research.initializing)runResearch()});
  fillMulti($('#researchBooks'),data.bookmaker,()=>{if(research.loaded&&!research.initializing)runResearch()});
  updateResearchDependencies(true);
  research.initializing=false;
  $('#researchUpdated').textContent=`Statistiche aggiornate: ${fmtDate(data.generato_utc)}`;
  $('#researchAvailable').textContent=`${data.numero_eventi.toLocaleString('it-IT')} eventi · ${data.numero_confronti.toLocaleString('it-IT')} confronti`;
}

async function loadResearch(){
  if(research.loaded||research.loading)return;
  research.loading=true;$('#researchLoading').className='loading';$('#researchLoading').textContent='Caricamento dati statistici…';
  try{
    research.data=await loadJson(`${DATA_BASE_URL}/ricerca_statistica.json`);
    if(Number(research.data.schema_version)!==1)throw new Error('Versione dei dati non supportata');
    research.records=decodeResearchData(research.data);research.loaded=true;
    initializeResearchControls();$('#researchLoading').classList.add('hidden');$('#researchWorkspace').classList.remove('hidden');runResearch();
  }catch(error){$('#researchLoading').className='error';$('#researchLoading').textContent=`Impossibile caricare la ricerca statistica: ${error.message}`}
  finally{research.loading=false}
}

function selectedResearchRows(){
  const minimum=Number($('#researchMin').value),maximum=Number($('#researchMax').value),horizon=Number($('#researchHorizon').value),finalHours=Number($('#researchFinalMax').value),markets=multiValues($('#researchMarket')),lines=multiValues($('#researchLine')),outcomes=multiValues($('#researchOutcome')),competitions=multiValues($('#researchCompetition')),books=multiValues($('#researchBooks'));
  if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<=1||maximum<minimum)throw new Error('Intervallo quota non valido');
  if(!markets.size||!lines.size||!outcomes.size||!competitions.size||!books.size)return[];
  return research.records.filter(r=>r.horizon===horizon&&r.initial>=minimum&&r.initial<=maximum&&r.finalMinutes<=finalHours*60&&markets.has(r.market)&&lines.has(r.line)&&outcomes.has(r.outcome)&&competitions.has(r.competition)&&books.has(r.bookmaker));
}
function limitedResearchRows(rows){
  const limit=Number($('#researchLimit').value),events=[...new Map(rows.map(r=>[r.eventId,r.kickoff])).entries()].sort((a,b)=>b[1]-a[1]);
  const selected=limit?events.slice(0,limit):events,ids=new Set(selected.map(x=>x[0]));
  return{rows:rows.filter(r=>ids.has(r.eventId)),availableEvents:events.length,usedEvents:ids.size};
}
function eventSamples(rows){
  const groups=new Map();rows.forEach(r=>{const key=[r.eventId,r.market,r.line,r.outcome].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
  return[...groups.values()].map(group=>({eventId:group[0].eventId,match:group[0].match,competition:group[0].competition,kickoff:group[0].kickoff,market:group[0].market,line:group[0].line,outcome:group[0].outcome,bookmaker:`${group.length} operatori`,initial:researchMedian(group.map(r=>r.initial)),final:researchMedian(group.map(r=>r.final)),variation:researchMedian(group.map(r=>r.variation)),series:group.length,finalMinutes:researchMedian(group.map(r=>r.finalMinutes))}));
}
function researchMetrics(samples,threshold){
  const down=samples.filter(x=>researchDirection(x.variation,threshold)==='down').length,up=samples.filter(x=>researchDirection(x.variation,threshold)==='up').length,flat=samples.length-down-up,variations=samples.map(x=>x.variation);
  return{total:samples.length,down,up,flat,average:researchAverage(variations),median:researchMedian(variations)};
}
function researchCards(metrics,events,series,unit){
  const cards=[['Partite analizzate',events],['Serie bookmaker',series],[unit==='events'?'Selezioni analizzate':'Serie analizzate',metrics.total],[unit==='events'?'Selezioni in discesa':'Serie in discesa',`${metrics.down} · ${researchPercent(metrics.down,metrics.total)}`],[unit==='events'?'Selezioni in salita':'Serie in salita',`${metrics.up} · ${researchPercent(metrics.up,metrics.total)}`],['Invariate',`${metrics.flat} · ${researchPercent(metrics.flat,metrics.total)}`],['Variazione media',researchSigned(metrics.average)],['Variazione mediana',researchSigned(metrics.median)]];
  $('#researchSummary').innerHTML=cards.map(([label,value])=>`<div class="card"><span>${label}</span><strong>${value}</strong></div>`).join('');
}
function groupedResearchTable(rows,field,threshold,title,limit=20){
  const groups=new Map();rows.forEach(r=>{const key=r[field];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
  const values=[...groups.entries()].map(([name,items])=>({name,items,metrics:researchMetrics(items,threshold),events:new Set(items.map(x=>x.eventId)).size})).sort((a,b)=>b.events-a.events||b.items.length-a.items.length).slice(0,limit);
  return`<section class="research-block"><h3>${title}</h3><div class="table-wrap"><table class="data-table research-table"><thead><tr><th>Nome</th><th>Partite</th><th>Serie</th><th>Discesa</th><th>Salita</th><th>Invariata</th><th>Variazione media</th></tr></thead><tbody>${values.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${x.events}</td><td>${x.items.length}</td><td class="negative">${researchPercent(x.metrics.down,x.metrics.total)}</td><td class="positive">${researchPercent(x.metrics.up,x.metrics.total)}</td><td>${researchPercent(x.metrics.flat,x.metrics.total)}</td><td>${researchSigned(x.metrics.average)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function researchExamples(samples,threshold){
  const rows=[...samples].sort((a,b)=>Math.abs(b.variation)-Math.abs(a.variation)).slice(0,30);
  return`<section class="research-block"><h3>Variazioni più ampie nel campione</h3><div class="table-wrap"><table class="data-table research-table"><thead><tr><th>Partita</th><th>Mercato</th><th>Esito</th><th>Campionato</th><th>Data</th><th>Operatore/i</th><th>Quota iniziale</th><th>Quota finale</th><th>Variazione</th><th>Direzione</th><th>Ultima rilevazione</th></tr></thead><tbody>${rows.map(x=>{const direction=researchDirection(x.variation,threshold);return`<tr><td><strong>${esc(x.match)}</strong></td><td>${esc(researchMarketLabel(x.market))}${x.line?` · ${esc(x.line)}`:''}</td><td><strong>${esc(x.outcome)}</strong></td><td>${esc(x.competition)}</td><td>${fmtDate(new Date(x.kickoff).toISOString())}</td><td>${esc(x.bookmaker)}</td><td>${fmtNumber(x.initial,3)}</td><td>${fmtNumber(x.final,3)}</td><td class="${direction==='down'?'negative':direction==='up'?'positive':''}">${researchSigned(x.variation)}</td><td>${researchDirectionLabel(x.variation,threshold)}</td><td>${fmtNumber(x.finalMinutes/60,1)} ore prima</td></tr>`}).join('')}</tbody></table></div></section>`;
}
function runResearch(){
  if(!research.loaded)return;
  try{
    const all=selectedResearchRows(),limited=limitedResearchRows(all),unit=$('#researchUnit').value,threshold=Math.max(0,Number($('#researchThreshold').value)||0),samples=unit==='events'?eventSamples(limited.rows):limited.rows,metrics=researchMetrics(samples,threshold);
    if(!samples.length){$('#researchMessage').className='research-method warn';$('#researchMessage').textContent='Nessun confronto disponibile con i filtri selezionati. Amplia il range della quota, la distanza finale o il numero di bookmaker.';$('#researchSummary').innerHTML='';$('#researchResults').innerHTML='';return}
    const horizon=Number($('#researchHorizon').value),finalHours=Number($('#researchFinalMax').value),limit=Number($('#researchLimit').value);
    const smallSample=limited.usedEvents<=5?` <strong>Campione ridotto:</strong> prova un orizzonte iniziale più vicino o aumenta il limite dell’ultima rilevazione.`:'';
    $('#researchMessage').className=`research-method${limited.usedEvents<=5?' warn':''}`;$('#researchMessage').innerHTML=`Quota iniziale osservata <strong>${horizon} ore prima</strong>; ultima quota rilevata entro <strong>${finalHours} ore</strong> dall’evento. Disponibili <strong>${limited.availableEvents}</strong> partite, utilizzate <strong>${limited.usedEvents}</strong>${limit&&limited.availableEvents>limit?' (le più recenti)':''}. Ogni combinazione partita–mercato–linea–esito resta distinta. Movimento inferiore o uguale a <strong>${fmtNumber(threshold,1)}%</strong> considerato invariato.${smallSample}`;
    researchCards(metrics,limited.usedEvents,limited.rows.length,unit);
    $('#researchResults').innerHTML=groupedResearchTable(limited.rows,'bookmaker',threshold,'Risultati per bookmaker')+groupedResearchTable(limited.rows,'competition',threshold,'Risultati per campionato',30)+researchExamples(samples,threshold);
  }catch(error){$('#researchMessage').className='research-method warn';$('#researchMessage').textContent=error.message;$('#researchSummary').innerHTML='';$('#researchResults').innerHTML=''}
}
function resetResearch(){
  research.initializing=true;$('#researchMin').value='1.35';$('#researchMax').value='1.65';$('#researchHorizon').value=research.data.regole.orizzonti_ore.includes(72)?'72':String(research.data.regole.orizzonti_ore[0]);$('#researchFinalMax').value='72';$('#researchUnit').value='events';$('#researchLimit').value='100';$('#researchThreshold').value='0';fillResearchMulti($('#researchMarket'),research.data.mercati,'Tutti i mercati','Nessun mercato',researchMarketLabel,()=>{});fillResearchMulti($('#researchCompetition'),research.data.campionati,'Tutti i campionati','Nessun campionato',value=>value,()=>{});fillMulti($('#researchBooks'),research.data.bookmaker,()=>{});updateResearchDependencies(true);research.initializing=false;runResearch();
}
function setHistoryMode(mode){
  const statistical=mode==='research';$('#trendSection').classList.toggle('hidden',statistical);$('#researchSection').classList.toggle('hidden',!statistical);$('#showTrendSection').classList.toggle('active',!statistical);$('#showResearchSection').classList.toggle('active',statistical);$('#showTrendSection').setAttribute('aria-selected',String(!statistical));$('#showResearchSection').setAttribute('aria-selected',String(statistical));if(statistical)loadResearch();
}

$('#showTrendSection').addEventListener('click',()=>setHistoryMode('trend'));
$('#showResearchSection').addEventListener('click',()=>setHistoryMode('research'));
['researchMin','researchMax','researchHorizon','researchFinalMax','researchUnit','researchLimit','researchThreshold'].forEach(id=>$('#'+id).addEventListener('change',runResearch));
$('#runResearch').addEventListener('click',runResearch);$('#resetResearch').addEventListener('click',resetResearch);
if(new URLSearchParams(location.search).get('modalita')==='ricerca')setHistoryMode('research');
