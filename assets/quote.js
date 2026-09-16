"use strict";
const quoteState={mode:'quote',quote:null,operations:null,rows:[],limit:200,token:0};

function normalizeRow(x,mode){
  if(mode==='quote')return{...x,_book:x.bookmaker,_exchange:'',_quote:Number(x.quota),_roi:null,_conv:null,_loss:null,_liquidity:Number(x.liquidita||0),_date:x.data_ora_evento};
  return{...x,_book:x.bookmaker_punta,_exchange:x.exchange_banca,_quote:Number(x.quota_punta),_roi:Number(x.roi_percento),_conv:Number(x.conversione_capitale_percento),_loss:Math.abs(Number(x.roi_percento||0)),_liquidity:Number(x.liquidita_banca||0),_date:x.data_ora_evento};
}
function classification(x){return String(x.classificazione||x.tipo_operazione||x.tipo||'').toUpperCase()}
function modeRows(){
  if(quoteState.mode==='quote')return(quoteState.quote?.quote||[]).map(x=>normalizeRow(x,'quote'));
  return(quoteState.operations?.operazioni||[]).filter(x=>{const c=classification(x),roi=Number(x.roi_percento||0);return quoteState.mode==='bonus'?(c.includes('COPERTURA')||(!c&&roi<0)):(c.includes('SUREBET')||(!c&&roi>=0))}).map(x=>normalizeRow(x,'operation'));
}
function filterOptions(){
  const rows=quoteState.rows;
  fillMulti($('#book'),rows.map(x=>x._book),()=>render(true));
  if(quoteState.mode!=='quote')fillMulti($('#exchange'),rows.map(x=>x._exchange),()=>render(true));else $('#exchange').innerHTML='';
  fillSelect($('#competition'),rows.map(x=>x.campionato),'Tutti i campionati');fillMarketSelect($('#market'),rows.map(x=>x.mercato));
  $$('.bonus-only').forEach(x=>x.classList.toggle('hidden',quoteState.mode==='quote'));
  $('#sort').querySelector('[value="roi_desc"]').disabled=quoteState.mode==='quote';
  if(quoteState.mode==='quote'&&$('#sort').value==='roi_desc')$('#sort').value='quote_desc';
}
function sortRows(rows){
  const sort=$('#sort').value;
  return rows.sort((a,b)=>sort==='quote_asc'?a._quote-b._quote:sort==='roi_desc'?b._roi-a._roi:sort==='date_asc'?new Date(a._date)-new Date(b._date):sort==='liquidity_desc'?b._liquidity-a._liquidity:b._quote-a._quote);
}
function render(reset=true){
  if(reset)quoteState.limit=200;
  const books=multiValues($('#book')),exchanges=quoteState.mode==='quote'?null:multiValues($('#exchange')),q=$('#q').value,c=$('#competition').value,m=$('#market').value,min=Number($('#minQuote').value||0),max=Number($('#maxQuote').value||99999),conv=Number($('#minConv').value||0),loss=Number($('#maxLoss').value||100);
  const rows=sortRows(quoteState.rows.filter(x=>textIncludes(x,q)&&books.has(x._book)&&(!exchanges||exchanges.has(x._exchange))&&(!c||x.campionato===c)&&(!m||x.mercato===m)&&x._quote>=min&&x._quote<=max&&(quoteState.mode==='quote'||(x._conv>=conv&&x._loss<=loss))));
  $('#count').textContent=`${rows.length.toLocaleString('it-IT')} risultati`;
  if(!rows.length){$('#view').className='empty';$('#view').textContent='Nessun risultato con i filtri selezionati.';$('#shown').textContent='';return}
  $('#view').className='table-wrap';$('#view').innerHTML=quoteState.mode==='quote'?quoteTable(rows.slice(0,quoteState.limit)):operationTable(rows.slice(0,quoteState.limit));
  $('#shown').textContent=`Mostrati ${Math.min(quoteState.limit,rows.length).toLocaleString('it-IT')} di ${rows.length.toLocaleString('it-IT')}`;$('#more').disabled=quoteState.limit>=rows.length;
}
function quoteTable(rows){return`<table class="data-table"><thead><tr><th>Partita</th><th>Data</th><th>Campionato</th><th>Operatore</th><th>Mercato</th><th>Linea</th><th>Esito</th><th>Tipo</th><th>Quota</th><th>Ultima conferma</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.partita)}</td><td>${fmtDate(x.data_ora_evento)}</td><td>${esc(x.campionato)}</td><td>${esc(x._book)}</td><td>${esc(marketLabel(x.mercato))}</td><td>${esc(x.linea)}</td><td>${esc(x.esito)}</td><td>${esc(x.tipo_quota)}</td><td><strong>${fmtNumber(x._quote,3)}</strong></td><td>${fmtDate(x.ultima_conferma)}</td></tr>`).join('')}</tbody></table>`}
function operationTable(rows){return`<table class="data-table"><thead><tr><th>Partita</th><th>Data</th><th>Mercato</th><th>Esito</th><th>Operatore Punta</th><th>Quota</th><th>Exchange</th><th>Banca</th><th>Liquidità</th><th>ROI</th><th>Conversione</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.partita)}</td><td>${esc(x.data_ora_evento)}</td><td>${esc(marketLabel(x.mercato))} ${esc(x.linea)}</td><td>${esc(x.esito)}</td><td>${esc(x._book)}</td><td><strong>${fmtNumber(x._quote,2)}</strong></td><td>${esc(x._exchange)}</td><td>${fmtNumber(x.quota_banca,2)}</td><td>${fmtNumber(x._liquidity,2)}</td><td class="${x._roi>=0?'positive':'negative'}">${fmtNumber(x._roi,3)}%</td><td>${fmtNumber(x._conv,3)}%</td></tr>`).join('')}</tbody></table>`}
async function setMode(mode){
  quoteState.mode=mode;quoteState.token++;const token=quoteState.token;$$('.mode-tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));$('#view').className='loading';$('#view').textContent='Caricamento dati…';
  try{
    if(mode==='quote'&&!quoteState.quote)quoteState.quote=await loadJson('data/storico_quote_attuali.json');
    if(mode!=='quote'&&!quoteState.operations)quoteState.operations=await loadJson('data/punta_banca_bonus.json');
    if(token!==quoteState.token)return;quoteState.rows=modeRows();const source=mode==='quote'?quoteState.quote:quoteState.operations;setUpdated(source?.ciclo?.terminato_al_utc||source?.aggiornamento_quote||source?.generato_al_utc);filterOptions();render(true);
  }catch(e){$('#view').className='error';$('#view').textContent=`Impossibile caricare i dati: ${e.message}`;setUpdated(null)}
}
$$('.mode-tab').forEach(x=>x.addEventListener('click',()=>setMode(x.dataset.mode)));['q','competition','market','minQuote','maxQuote','minConv','maxLoss','sort'].forEach(id=>$('#'+id).addEventListener('input',()=>render(true)));$('#more').addEventListener('click',()=>{quoteState.limit+=200;render(false)});const requested=new URLSearchParams(location.search).get('modalita');setMode(['bonus','punta_banca'].includes(requested)?requested:'quote');
