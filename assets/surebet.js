"use strict";

const surebetState={mode:'tradizionali',traditional:null,puntaBanca:null,traditionalRows:[],puntaBancaRows:[],renderedRows:[]};
const updateSchedule=['09:00','09:40','10:20','11:00','11:40','12:20','13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20','19:00','19:40','20:20','21:00'];

function operationType(row){return String(row.tipo_operazione||row.classificazione||row.tipo||'').toUpperCase()}
function normalizePuntaBanca(row){return{...row,_book:row.bookmaker_punta,_exchange:row.exchange_banca,_roi:Number(row.roi_percento||0),_liquidity:Number(row.liquidita_banca||0),_date:row.data_ora_evento}}

function traditionalRows(){
  const q=$('#tradQ').value,competition=$('#tradCompetition').value,market=$('#tradMarket').value,minimum=Number($('#tradRoi').value||0);
  return surebetState.traditionalRows.filter(row=>textIncludes(row,q)&&(!competition||row.campionato===competition)&&(!market||row.mercato===market)&&Number(row.roi_percento)>=minimum).sort((a,b)=>Number(b.roi_percento)-Number(a.roi_percento));
}
function puntaBancaRows(){
  const q=$('#pbQ').value,books=multiValues($('#pbBook')),exchanges=multiValues($('#pbExchange')),competition=$('#pbCompetition').value,market=$('#pbMarket').value,minimumRoi=Number($('#pbRoi').value||0),minimumLiquidity=Number($('#pbLiquidity').value||0),sort=$('#pbSort').value;
  const rows=surebetState.puntaBancaRows.filter(row=>textIncludes(row,q)&&books.has(row._book)&&exchanges.has(row._exchange)&&(!competition||row.campionato===competition)&&(!market||row.mercato===market)&&row._roi>=minimumRoi&&row._liquidity>=minimumLiquidity);
  return rows.sort((a,b)=>sort==='liquidity_desc'?b._liquidity-a._liquidity:sort==='date_asc'?String(a._date).localeCompare(String(b._date),'it'):b._roi-a._roi);
}
function traditionalTable(rows){return`<table class="data-table"><thead><tr><th>Evento</th><th>Data</th><th>Campionato</th><th>Mercato</th><th>ROI</th><th>Esiti e operatori</th><th>Azioni</th></tr></thead><tbody>${rows.slice(0,500).map((row,index)=>`<tr><td>${esc(row.partita)}</td><td>${esc(row.data_ora_evento)}</td><td>${esc(row.campionato)}</td><td>${esc(marketLabel(row.mercato))} ${esc(row.linea??'')}</td><td class="positive">${fmtNumber(row.roi_percento,3)}%</td><td>${(row.esiti||[]).map(item=>`${esc(item.esito)} @ <strong>${fmtNumber(item.quota,2)}</strong> · ${esc((item.bookmaker||[]).join(', '))}`).join('<br>')}</td><td><button type="button" class="calculate-row-button" data-calculate-index="${index}">Invia al calcolatore</button></td></tr>`).join('')}</tbody></table>`}
function puntaBancaTable(rows){return`<table class="data-table"><thead><tr><th>Partita</th><th>Data</th><th>Mercato</th><th>Esito</th><th>Operatore Punta</th><th>Quota Punta</th><th>Exchange</th><th>Quota Banca</th><th>Liquidità</th><th>ROI</th><th>Utile stimato</th><th>Azioni</th></tr></thead><tbody>${rows.slice(0,500).map((row,index)=>`<tr><td>${esc(row.partita)}</td><td>${esc(row.data_ora_evento)}</td><td>${esc(marketLabel(row.mercato))} ${esc(row.linea??'')}</td><td>${esc(row.esito)}</td><td>${esc(row._book)}</td><td><strong>${fmtNumber(row.quota_punta,2)}</strong></td><td>${esc(row._exchange)}</td><td>${fmtNumber(row.quota_banca,2)}</td><td>${fmtNumber(row._liquidity,2)} €</td><td class="positive">${fmtNumber(row._roi,3)}%</td><td>${fmtNumber(Math.min(Number(row.utile_se_vince_bookmaker||0),Number(row.utile_se_vince_exchange||0)),2)} €</td><td><button type="button" class="calculate-row-button" data-calculate-index="${index}">Invia al calcolatore</button></td></tr>`).join('')}</tbody></table>`}

function renderUpdateSchedule(){
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
  let next='';
  $('#updateTimes').innerHTML=updateSchedule.map(time=>{
    const [hours,mins]=time.split(':').map(Number),value=hours*60+mins;
    let state='future';
    if(value<=minutes)state='done';
    else if(!next){state='next';next=time}
    return `<span class="update-time ${state}">${time}</span>`;
  }).join('');
  $('#nextUpdate').textContent=next?`Prossimo avvio: ${next}`:minutes<9*60?'Prossimo avvio: 09:00':'Raccolte odierne concluse';
}

function calculatorUrl(row){
  const params=new URLSearchParams({origine:'surebet',partita:row.partita||'',mercato:marketLabel(row.mercato)+(row.linea?` ${row.linea}`:'')});
  if(surebetState.mode==='tradizionali'){
    const outcomes=(row.esiti||[]).slice(0,3);
    params.set('esiti',String(outcomes.length));
    outcomes.forEach((item,index)=>{
      const number=index+1;
      params.set(`esito${number}`,String(item.esito??''));
      params.set(`quota${number}`,String(item.quota??''));
      params.set(`bookmaker${number}`,(item.bookmaker||[]).join(', '));
    });
    return `calcolatore-puntate.html?${params}`;
  }
  params.set('tipo','REALE');
  params.set('puntata',String(row.puntata_bookmaker||30));
  params.set('quotaPunta',String(row.quota_punta||''));
  params.set('quotaBanca',String(row.quota_banca||''));
  params.set('commissione',String(row.commissione_percento??5));
  params.set('liquidita',String(row._liquidity||0));
  params.set('esito',String(row.esito||''));
  params.set('bookmakerPunta',String(row._book||''));
  params.set('exchangeBanca',String(row._exchange||''));
  return `calcolatore-punta-banca.html?${params}`;
}

function openCalculator(index){
  const row=surebetState.renderedRows[index];
  if(row)window.open(calculatorUrl(row),'_blank','noopener');
}

function renderSurebet(){
  const rows=surebetState.mode==='tradizionali'?traditionalRows():puntaBancaRows();
  surebetState.renderedRows=rows.slice(0,500);
  $('#count').textContent=`${rows.length.toLocaleString('it-IT')} opportunità`;
  if(!rows.length){$('#view').className='empty';$('#view').textContent='Nessuna opportunità con i filtri selezionati.';return}
  $('#view').className='table-wrap';$('#view').innerHTML=surebetState.mode==='tradizionali'?traditionalTable(rows):puntaBancaTable(rows);
}
function setSurebetMode(mode){
  surebetState.mode=mode;
  $$('[data-surebet-mode]').forEach(button=>{const active=button.dataset.surebetMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
  $('#traditionalSection').classList.toggle('hidden',mode!=='tradizionali');
  $('#puntaBancaSection').classList.toggle('hidden',mode!=='punta_banca');
  const source=mode==='tradizionali'?surebetState.traditional:surebetState.puntaBanca;
  setUpdated(source?.aggiornamento_quote||source?.generato_al_utc);
  renderSurebet();
}
function initializeSurebet(){
  const traditional=surebetState.traditional,puntaBanca=surebetState.puntaBanca;
  surebetState.traditionalRows=traditional.opportunita||[];
  surebetState.puntaBancaRows=(puntaBanca.operazioni||[]).filter(row=>operationType(row).includes('SUREBET')).map(normalizePuntaBanca);
  $('#traditionalBadge').textContent=surebetState.traditionalRows.length.toLocaleString('it-IT');
  $('#puntaBancaBadge').textContent=surebetState.puntaBancaRows.length.toLocaleString('it-IT');
  fillSelect($('#tradCompetition'),traditional.filtri?.campionati||surebetState.traditionalRows.map(row=>row.campionato),'Tutti i campionati');
  fillMarketSelect($('#tradMarket'),traditional.filtri?.mercati||surebetState.traditionalRows.map(row=>row.mercato));
  fillMulti($('#pbBook'),surebetState.puntaBancaRows.map(row=>row._book),renderSurebet);
  fillMulti($('#pbExchange'),surebetState.puntaBancaRows.map(row=>row._exchange),renderSurebet);
  fillSelect($('#pbCompetition'),surebetState.puntaBancaRows.map(row=>row.campionato),'Tutti i campionati');
  fillMarketSelect($('#pbMarket'),surebetState.puntaBancaRows.map(row=>row.mercato));
  ['tradQ','tradCompetition','tradMarket','tradRoi','pbQ','pbCompetition','pbMarket','pbRoi','pbLiquidity','pbSort'].forEach(id=>$('#'+id).addEventListener('input',renderSurebet));
  $$('[data-surebet-mode]').forEach(button=>button.addEventListener('click',()=>setSurebetMode(button.dataset.surebetMode)));
  $('#view').addEventListener('click',event=>{const button=event.target.closest('[data-calculate-index]');if(button)openCalculator(Number(button.dataset.calculateIndex))});
  renderUpdateSchedule();setInterval(renderUpdateSchedule,60000);
  const requested=new URLSearchParams(location.search).get('modalita');setSurebetMode(requested==='punta_banca'?'punta_banca':'tradizionali');
}

Promise.all([loadJson(`${DATA_BASE_URL}/surebet_tradizionali.json`),loadJson(`${DATA_BASE_URL}/punta_banca_bonus.json`)]).then(([traditional,puntaBanca])=>{surebetState.traditional=traditional;surebetState.puntaBanca=puntaBanca;initializeSurebet()}).catch(error=>{$('#view').className='error';$('#view').textContent=`Impossibile caricare le surebet: ${error.message}`;setUpdated(null)});
