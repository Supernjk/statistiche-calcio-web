"use strict";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmtNumber=(v,d=2)=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtDate=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`Dati non disponibili (${r.status})`);return r.json()}
function fillSelect(el,values,label='Tutti'){el.innerHTML=`<option value="">${label}</option>`+[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'it')).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}
const marketLabels={MATCH_RESULT:'Esito finale 1X2',TOTAL_GOALS:'Under/Over',BOTH_TEAMS_TO_SCORE:'Gol/No Gol'};
function marketLabel(value){return marketLabels[value]||String(value||'')}
function fillMarketSelect(el,values){el.innerHTML='<option value="">Tutti</option>'+[...new Set(values.filter(Boolean))].sort((a,b)=>marketLabel(a).localeCompare(marketLabel(b),'it')).map(v=>`<option value="${esc(v)}">${esc(marketLabel(v))}</option>`).join('')}
function normalizedText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function quoteSearch(row,query){const q=normalizedText(query);if(!q)return true;return normalizedText([row.partita,row.campionato,row.bookmaker,row.mercato,marketLabel(row.mercato),row.linea,row.esito,row.tipo_quota].join(' ')).includes(q)}
function fillMulti(el,values,onChange){const unique=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'it'));el.innerHTML=`<summary>Tutti gli operatori</summary><div class="multi-panel"><div class="multi-actions"><button type="button" data-all>Tutti</button><button type="button" data-none>Nessuno</button></div>${unique.map(v=>`<label class="multi-option"><input type="checkbox" value="${esc(v)}" checked> ${esc(v)}</label>`).join('')}</div>`;const boxes=()=>[...el.querySelectorAll('input[type=checkbox]')];const update=()=>{const selected=boxes().filter(x=>x.checked);el.querySelector('summary').textContent=selected.length===unique.length?'Tutti gli operatori':selected.length===0?'Nessun operatore':selected.length===1?selected[0].value:`${selected.length} operatori`;onChange()};el.querySelector('[data-all]').onclick=()=>{boxes().forEach(x=>x.checked=true);update()};el.querySelector('[data-none]').onclick=()=>{boxes().forEach(x=>x.checked=false);update()};boxes().forEach(x=>x.addEventListener('change',update));update()}
function multiValues(el){return new Set([...el.querySelectorAll('input:checked')].map(x=>x.value))}
function textIncludes(row,q){return!q||Object.values(row).flat(Infinity).join(' ').toLowerCase().includes(q.toLowerCase())}
function setUpdated(value){const el=$('#updated');if(el)el.textContent=value?`Quote aggiornate: ${fmtDate(value)}`:'Aggiornamento non disponibile'}
document.addEventListener('DOMContentLoaded',()=>{const file=location.pathname.split('/').pop()||'index.html';$$('.nav a').forEach(a=>{if(a.getAttribute('href')===file)a.classList.add('attivo')})});
