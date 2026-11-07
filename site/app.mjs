import {loadCatalogFile,registerPwa} from './pwa.mjs';
import {openDeckStore} from './deck-store.mjs?v=20261107retire';
import {zones,destinations,setDeckQuantity,moveDeckCard,officialDeckText} from './workbench.mjs?v=20261031a';
import {attachAutocomplete} from './autocomplete.mjs?v=20261026a';
import {confirmedDeckDate,validatePublishingData,collectEventResults,renderEventResult,renderEventSummary,eventPlaceholder,eventRoute} from './publishing.mjs?v=20261106events';
import {uuid,archetypeEnglish,groupDeckLines,normalize,colorNames,types,subtypeNames,oracleWords,subtypes,prepare,cardMatches,deckMatches,createBackup,validateLocalState,appendBackup,eventDate,eventSortKey,validOptionalDate,externalEntryUrl,insertDeckText,parseDeck,printingOptions,printingCaption,printingFallbackReason,validateDraftRecovery,canDismissBackdrop} from './core.mjs?v=20261107retire';

const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SESSION='atlantis.functional.search.v1';
let cards=[], decks=[], deckLoadFailed=false, events=[], eventLoadState="loading", tournamentResults=[], resultLoadState="loading", cardMap=new Map(), meta={}, loadFailed=false, hideImages=false, selectedCards=[], cardPage=1, toastTimer, pendingDelete=null, local={version:2,decks:[],trash:[]}, storageOk=true, currentView='home', composing=false;
const pageSize=24;
const imagesDisabled=()=>hideImages||!navigator.onLine;
const PRINT_MODE='atlantis.printing.mode.v1',DRAFT_SESSION='atlantis.editor.draft.v1';
const DEFAULT_PRINTING_MODE='en';
let printingMode=DEFAULT_PRINTING_MODE,printings=null,pendingDraft=null,draftRevision=null,draftStorageBaseline=null;
try{const saved=localStorage.getItem(PRINT_MODE);if(['en','ja'].includes(saved))printingMode=saved;}catch{}
let draftActive=false,draftBase=null,draftEpoch=0,searchReady=false;
let cardPool=[],poolUndo=[],poolOpener=null,storageBaseline=null;
let deckUpdates;try{if(typeof BroadcastChannel==='function')deckUpdates=new BroadcastChannel('atlantis.my-decks.updated');}catch{}
deckUpdates?.addEventListener('message',()=>message('別のタブでマイデッキが更新されました。Reload Decksで内容を確認してください。'));
function message(text,action){clearTimeout(toastTimer);$('#toast').hidden=false;$('#toast').innerHTML=esc(text)+(action?'<button id="toast-action">Undo</button>':'');if(action)$('#toast-action').onclick=action;toastTimer=setTimeout(()=>$('#toast').hidden=true,8000);}
async function readLocal(){try{const state=await deckStore.read();local=state.data;storageBaseline=String(state.revision);storageOk=true;}catch(e){storageOk=false;$('#my-status').textContent='保存データを読み取れません。元データは保持しています。'+e.message;$('#my-status').className='error';throw e;}}
async function persist(next){
 if(!storageOk||!deckStore)throw new Error('このブラウザの保存領域を利用できません。');
 const result=await deckStore.commit(next);local=result.data;storageBaseline=String(result.revision);
 try{deckUpdates?.postMessage({revision:result.revision});}catch{}
}
function field(id){return $('#'+id).value;}
function selectedColors(prefix){return $$(`#${prefix}-colors input:checked`).map(x=>x.value);}
function cardFilters(){return {name:field('card-name'),oracle:field('card-oracle'),keyword:field('card-keyword'),colors:selectedColors('card'),colorMode:field('card-color-mode'),types:$$('#card-types input:checked').map(x=>x.value),min:Number(field('card-min'))===0?'':field('card-min'),max:field('card-max')===$('#card-max').max?'':field('card-max')};}
// Range endpoints cover the full loaded pool; full extent means no bound.
function syncManaSliders(changed){
 const min=$('#card-min'),max=$('#card-max');
 if(Number(min.value)>Number(max.value)){if(changed==='card-min')max.value=min.value;else min.value=max.value;}
 for(const input of [min,max]){const value=Number(input.value),limit=Number(input.max);$('#'+input.id+'-value').value=String(value);input.setAttribute('aria-valuetext',String(value));input.style.setProperty('--range-position',(limit?value/limit*100:0)+'%');}
}
function renderManaTicks(limit){
 for(const id of ['card-min','card-max']){
  const input=$('#'+id);
  let ruler=input.nextElementSibling;
  if(!ruler?.classList.contains('mana-ticks')){
   ruler=document.createElement('div');
   ruler.className='mana-ticks';
   ruler.setAttribute('aria-hidden','true');
   input.after(ruler);
  }
  ruler.replaceChildren();
  for(let value=0;value<=limit;value++){
   const tick=document.createElement('span');
   if(value%5===0){tick.className='major';tick.textContent=String(value);}
   tick.style.left=(value/limit*100)+'%';
   ruler.append(tick);
  }
 }
}
function clearManaBound(id){const input=$('#'+id);input.value=id==='card-min'?'0':input.max;syncManaSliders();}
function deckFilters(){return {query:field('deck-query'),cards:[...selectedCards],side:$('#deck-side').checked,colors:selectedColors('deck'),colorMode:field('deck-color-mode'),archetype:field('deck-archetype')};}
function date(v){return new Date(v).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function cardName(c){return c?.ja||c?.name||'不明なカード';}
function cardCaption(c){return c.ja?`${c.ja} / ${c.name}`:c.name+'（日本語名未収録）';}
function tags(colors){return (colors.length?colors:['C']).map(c=>`<span class="tag">${colorNames[c]}</span>`).join('');}
function imageMarkup(c,art=false,quantity=null){
 const counted=content=>quantity===null?content:`<span class="counted-card-image">${content}<strong class="published-quantity">${quantity}</strong></span>`;
 const selection=printingOptions(printings?.cards[c?.id],printingMode),chosen=selection.choices[0],url=art?(chosen?.art||chosen?.image):chosen?.image,cls=art?'art':'card-image',caption=printingCaption(chosen);
 return !url||imagesDisabled()?counted(`<div class="${cls} image-failed">${esc(cardName(c))}<br>画像なし・テキストで確認</div>`):`<figure class="printing-image" data-selected-print="${esc(chosen.id)}" data-printing-set="${esc(chosen.set)}">${counted(`<img class="${cls}" src="${esc(url)}" alt="${esc(cardName(c))} — ${esc(caption)}" data-image-card="${esc(c.id)}" data-image-art="${art?'1':'0'}" data-image-index="0" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">`)}<figcaption ${selection.reason?'':'hidden'}><span class="printing-fallback" ${selection.reason?'':'hidden'}>${esc(selection.reason)}</span></figcaption></figure>`;
}
document.addEventListener('error',e=>{
 const img=e.target;if(img.tagName!=='IMG'||!img.dataset.imageCard)return;
 const c=cardMap.get(img.dataset.imageCard),record=printings?.cards[c?.id],selection=printingOptions(record,printingMode),index=Number(img.dataset.imageIndex||0)+1,next=selection.choices[index],figure=img.closest('.printing-image');
 if(!figure)return;
 if(next&&navigator.onLine){
  const caption=printingCaption(next),reason=printingFallbackReason(record,printingMode,next,{imageFailed:true});
  img.dataset.imageIndex=index;figure.dataset.selectedPrint=next.id;figure.dataset.printingSet=next.set;
  img.alt=cardName(c)+' — '+caption+' — '+reason;
  figure.querySelector('figcaption').hidden=false;
  const status=figure.querySelector('.printing-fallback');status.textContent=reason;status.hidden=false;
  const card=figure.closest('.card');if(card){const meta=card.querySelector('.card-set');if(meta)meta.textContent='['+next.set.toUpperCase()+']';const note=card.querySelector('.card-fallback');if(note){note.textContent=reason;note.hidden=false;}}
  const link=figure.closest('.detail-top')?.querySelector('[data-printing-link]');if(link)link.href=next.url;
  img.src=img.dataset.imageArt==='1'?(next.art||next.image):next.image;return;
 }
 figure.querySelector('figcaption').hidden=false;
 const status=figure.querySelector('.printing-fallback');status.hidden=false;status.textContent='全候補の画像を取得できません';
 const note=figure.closest('.card')?.querySelector('.card-fallback');if(note){note.textContent=status.textContent;note.hidden=false;}
 const box=document.createElement('div');box.className=(img.className||'')+' image-failed';box.textContent=cardName(c)+' — 画像を取得できません';img.replaceWith(box);
},true);
function colorControls(prefix){const labels={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless',A:'Artifacts'};$('#'+prefix+'-colors').innerHTML=`<fieldset><legend>Colors</legend><div class="color-buttons">${Object.entries(colorNames).filter(([c])=>prefix==='card'||c!=='A').map(([c,name])=>`<label class="color-${c}"><input type="checkbox" value="${c}" aria-label="${labels[c]||name}"><span>${labels[c]||name}</span></label>`).join('')}</div><p class="hint color-default-note">デフォルトはOR検索します。</p></fieldset>`;}
function saveSearch(){if(!searchReady)return;try{const values={};$$('input[id],select[id]').filter(x=>!x.id.startsWith('edit-')&&!x.id.startsWith('pool-')&&!x.id.startsWith('builder-')&&!x.id.startsWith('workbench-')&&!['printing-mode','restore-file','hide-images','deck-card','my-query','my-sort','builder-target','builder-qty','builder-new-name-input'].includes(x.id)&&x.type!=='file'&&x.type!=='hidden').forEach(x=>values[x.id]=x.type==='checkbox'?x.checked:x.value);sessionStorage.setItem(SESSION,JSON.stringify({sortDefaultsVersion:2,values,selectedCards,cardPage,currentView,colors:{card:selectedColors('card'),deck:selectedColors('deck')},display:field('card-display')}));}catch{}}
function restoreSearch(){try{const saved=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(!saved)return;for(const[id,value]of Object.entries(saved.values||{})){const input=$('#'+id);if(input&&id!=='printing-mode'&&(!['deck-sort','card-sort'].includes(id)||saved.sortDefaultsVersion===2)){if(input.type==='checkbox')input.checked=!!value;else if(['card-min','card-max'].includes(id))input.value=value===''?(id==='card-min'?'0':input.max):String(value);else input.value=['card-color-mode','deck-color-mode'].includes(id)&&value==='exact'?'and':String(value);}}if(saved.values?.['card-type']){const legacy=$$('#card-types input').find(x=>x.value===saved.values['card-type']);if(legacy)legacy.checked=true;}syncManaSliders();for(const prefix of ['card','deck'])$$(`#${prefix}-colors input`).forEach(x=>x.checked=(saved.colors?.[prefix]||[]).includes(x.value));selectedCards=(saved.selectedCards||[]).filter(id=>cardMap.has(id));cardPage=Math.max(1,Number(saved.cardPage)||1);currentView=['home','decks','cards','events','my','guide','about'].includes(saved.currentView)?saved.currentView:'home';$('#card-display').value=saved.display==='list'?'list':'grid';}catch{}}
function navigate(view){
 const route={pool:'cards',mydecks:'my',cards:'cards',my:'my'};
 const eventPage=eventRoute(view);
 const next=eventPage?'events':route[view]||view;
 if(!['home','decks','cards','events','my','guide','about'].includes(next))return;
 const page=eventPage?.page||'view-'+next,changed=$('.view:not([hidden])')?.id!==page;
 currentView=next;
 $$('.view').forEach(v=>v.hidden=v.id!==page);
 const navHash={cards:'pool',my:'mydecks'}[next]||next;
 const hash=eventPage?view:navHash;
 $$('nav a[href^="#"]').forEach(a=>{const active=a.getAttribute('href')==='#'+navHash;if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(location.hash!=='#'+hash)history.replaceState({},'', '#'+hash);
 saveSearch();syncWorkbenchLayout();if(next==='my')renderMy();if(next==='events'){
  renderEvents();renderResults();
  if(changed){const heading=$('#'+page+' h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 }
}
function chip(text,action){return `<button class="chip" type="button" ${action}>${esc(text)} ×</button>`;}
function addActiveFilters(container,filters,kind){let out=[];const labels=kind==='card'?{name:'カード名',oracle:'能力',keyword:'キーワード',min:'マナ下限',max:'マナ上限'}:{query:'検索語',archetype:'分類'};for(const[k,label]of Object.entries(labels))if(filters[k]!==''&&filters[k]!=null)out.push(chip(label+'：'+(types[filters[k]]||filters[k]),`data-remove-field="${kind==='card'?'card':'deck'}-${k==='query'?'query':k}"`));for(const type of filters.types||[])out.push(chip('タイプ：'+(types[type]||type),`data-remove-type="${type}"`));for(const color of filters.colors)out.push(chip(colorNames[color],`data-remove-color="${kind}:${color}"`));$(container).innerHTML=out.join('');}
function renderSelected(){ $('#selected-cards').innerHTML=selectedCards.map(id=>chip(cardName(cardMap.get(id)),`data-remove-card="${id}"`)).join(''); }
function addDeckCard(){const q=normalize(field('deck-card'));if(!q)return;let c=cards.find(c=>normalize(c.name)===q||normalize(c.ja)===q);if(!c){const matches=cards.filter(c=>c.nameIndex.includes(q));if(matches.length===1)c=matches[0];else{message(matches.length?'候補からカード名を選んでください。':'取得データ内にカードが見つかりません。');return;}}if(!selectedCards.includes(c.id))selectedCards.push(c.id);$('#deck-card').value='';renderDecks();saveSearch();}
function empty(text,kind){return `<div class="empty"><h2>${esc(text)}</h2><p>検索語を短くするか、選択した条件を解除してください。</p><button type="button" data-reset="${kind}">Reset</button></div>`;}
function deckDateMarkup(date){return date?`<p class="hint published-deck-date">開催日：<time datetime="${date}">${date}</time></p>`:'';}
function deckTile(d,{localDeck=false,eventSummary=false}={}){
 const parsed=localDeck?parsedLocalDeck(d):null, hero=cardMap.get(localDeck?parsed.rows[0]?.id:d.hero);
 const colors=localDeck?[...new Set(parsed.rows.flatMap(row=>cardMap.get(row.id)?.colors||[]))]:d.colors;
 const action=localDeck?'data-local-view':'data-deck';
 const date=localDeck?'':confirmedDeckDate(d);
 return `<article class="deck-card featured-card"><button type="button" class="featured-open" ${action}="${esc(d.id)}" aria-label="${esc(d.name)}${date?` · 開催日 ${date}`:''} details">${imageMarkup(hero,true)}<div class="content"><span class="eyebrow">${esc(localDeck?'MY DECK':archetypeEnglish[d.archetype]||d.archetype)}</span><h3>${esc(d.name)}</h3>${deckDateMarkup(date)}<div class="deck-card-meta"><span>${esc(localDeck?'ブラウザ内のみ':d.author+(d.sample?' · SAMPLE':''))}${!localDeck&&d.result?`<br>${esc(d.event)} · ${esc(d.result)}${eventSummary?'<br>'+esc(d.venue):''}`:''}</span><span>${(colors.length?colors:['C']).map(x=>colorNames[x]).join(' / ')}</span></div></div></button>${localDeck?`<div class="small-actions"><button data-local-view="${esc(d.id)}">Open</button><button data-local-copy="${esc(d.id)}" aria-label="${esc(d.name)}をMy Deckとして複製">Copy</button><button data-local-export="${esc(d.id)}" aria-label="${esc(d.name)}をMO形式のTXTで書き出し">Export MO</button><button data-delete="${esc(d.id)}">Delete</button></div>`:''}</article>`;
}
function renderGuideDeckLinks(){
 const aliases={
  'カーミック・ボンバー':'白赤緑カーミック・ボンバー',
  '青赤緑激動アサルト':'青赤緑アサルト',
  '緑白ミラーリ・ウェイク':'緑白ミラーリウェイク'
 };
 for(const entry of $$('[data-guide-deck]')){
  const label=entry.dataset.guideDeck;
  const latest=decks.filter(deck=>!deck.sample&&deck.name===(aliases[label]||label))
   .sort((a,b)=>confirmedDeckDate(b).localeCompare(confirmedDeckDate(a))||b.updated.localeCompare(a.updated)||a.order-b.order)[0];
  entry.textContent=label;
  if(!latest)continue;
  const button=document.createElement('button');
  button.type='button';
  button.className='link-button';
  button.dataset.deck=latest.id;
  button.textContent=label;
  entry.replaceChildren(button);
 }
}
function renderDecks(){
 syncSearchSwitches();
 if(loadFailed||deckLoadFailed){$('#deck-result-count').textContent='読込失敗';$('#deck-results').innerHTML='<p class="empty">データを読み込めません。再読込をお試しください。</p>';return;}
 const f=deckFilters(),results=decks.filter(d=>deckMatches(d,f,cardMap)),sort=field('deck-sort');
 results.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ja'):sort==='updated'?b.updated.localeCompare(a.updated):a.order-b.order);
 $('#deck-result-count').textContent=`${results.length} / ${decks.length} 件`;renderSelected();addActiveFilters('#deck-active',f,'deck');
 $('#deck-results').innerHTML=results.map(d=>deckTile(d)).join('')||empty('該当するデッキはありません','decks');
}
function setCardPages(html){for(const target of $$('.card-pagination'))target.innerHTML=html;}
function renderCards(){
 syncSearchSwitches();
 if(loadFailed){setCardPages('');$('#card-result-count').textContent='読込失敗';$('#card-results').innerHTML='<p class="empty">データを読み込めません。再読込をお試しください。</p>';return;}
 const f=cardFilters();addActiveFilters('#card-active',f,'card');
 if(f.min!==''&&f.max!==''&&Number(f.min)>Number(f.max)){$('#card-result-count').textContent='マナ総量の範囲を確認';$('#card-results').innerHTML='<p class="empty">下限を上限以下にしてください。</p>';setCardPages('');return;}
 const sort=field('card-sort');
 const result=cards.filter(c=>cardMatches(c,f));
 result.sort((a,b)=>{
  const mana=sort==='mana'?a.mv-b.mv:sort==='mana-desc'?b.mv-a.mv:0;
  return mana||cardName(a).localeCompare(cardName(b),'ja');
 });
 const pages=Math.max(1,Math.ceil(result.length/pageSize));cardPage=Math.min(cardPage,pages);$('#card-result-count').textContent=`${result.length.toLocaleString()} / ${cards.length.toLocaleString()} 件`;
 const list=field('card-display')==='list';$('#card-results').className=list?'card-list':'card-grid';
 $('#card-results').innerHTML=result.slice((cardPage-1)*pageSize,cardPage*pageSize).map(c=>{
  const selection=printingOptions(printings?.cards[c.id],printingMode),set=selection.choices[0]?.set?.toUpperCase();
  return `<article class="card"><button type="button" class="card-image-button" data-card="${c.id}" aria-label="${esc(cardName(c))} — Card Details">${imageMarkup(c)}</button><div class="card-content"><h3 class="card-result-title"><button data-card="${c.id}">《${esc(cardName(c))}${c.ja&&c.ja!==c.name?' / '+esc(c.name):''}》</button> <span class="card-set">${set?'['+esc(set)+']':''}</span></h3><p class="card-fallback" ${selection.reason?'':'hidden'}>${esc(selection.reason)}</p><p class="card-tile-meta">${esc(c.type)}</p>${!c.ja?'<span class="badge">日本語名未収録</span>':''}<div class="card-add-actions" data-deck-add-actions ${draftActive?'':'hidden'}>${Object.keys(zones).map(zone=>`<button type="button" data-build-card="${c.id}" data-build-zone="${zone}" aria-label="${esc(cardName(c))}を${zones[zone]}に追加">+ ${zones[zone]}</button>`).join('')}</div></div></article>`;
 }).join('')||empty('該当するカードはありません','cards');
 setCardPages(result.length?`<button data-page="1" ${cardPage===1?'disabled':''}>First</button><button data-page="${cardPage-1}" ${cardPage===1?'disabled':''}>Previous</button><span>${cardPage} / ${pages}</span><button data-page="${cardPage+1}" ${cardPage===pages?'disabled':''}>Next</button><button data-page="${pages}" ${cardPage===pages?'disabled':''}>LAST</button>`:'');
}
let detailOpener=null,restoringDetail=false,activeDetailKey=null;
const detailPositions=new Map();
function captureDetailPosition(){
 if($('#detail').open&&history.state?.detail){detailPositions.set(activeDetailKey,$('#detail').scrollTop);history.replaceState({...history.state,detailScroll:$('#detail').scrollTop},'',location.href);}
}
function closeDetail(){
 if(!$('#detail').open)return;
 captureDetailPosition();const depth=history.state?.detailDepth||0;
 $('#detail').close();if(depth)history.go(-depth);
 if(detailOpener?.isConnected)detailOpener.focus({preventScroll:true});
}
function showDetail(html,type,id,mode='visual'){
 const dialog=$('#detail'),previous=history.state,wasOpen=dialog.open;
 if(!restoringDetail){
  captureDetailPosition();
  const same=wasOpen&&previous?.detail===type&&previous.id===id;
  const state={detail:type,id,detailMode:mode,detailScroll:0,detailKey:same?previous.detailKey:uuid(),detailDepth:same?previous.detailDepth:wasOpen?(previous?.detailDepth||1)+1:1};
  if(same)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
 }
 activeDetailKey=history.state?.detailKey;
 const position=restoringDetail?(detailPositions.get(activeDetailKey)??history.state?.detailScroll??0):0;
 dialog.dataset.kind=type;dialog.classList.toggle('has-back',(history.state?.detailDepth||1)>1);
 $('#detail-back').hidden=(history.state?.detailDepth||1)<=1;
 $('#detail-feedback').hidden=true;$('#detail-feedback').textContent='';
 $('#detail-body').innerHTML=html;
 const actions=$('#detail-actions');
 if(type==='deck')actions.innerHTML=`<button data-copy="${esc(id)}">Copy</button><button data-download="${esc(id)}">Download</button>`;
 else if(type==='card'){
  actions.innerHTML=`<div class="detail-add-actions" data-deck-add-actions ${draftActive?'':'hidden'}>${Object.keys(zones).map(zone=>`<button type="button" data-build-card="${esc(id)}" data-build-zone="${zone}">+ ${zones[zone]}</button>`).join('')}</div><button type="button" id="detail-open-storage">Deck Editor</button>`;
 }else actions.innerHTML='';
 if(!wasOpen){if(!restoringDetail)detailOpener=document.activeElement;dialog.showModal();}
 dialog.scrollTop=position;
 requestAnimationFrame(()=>{if(dialog.open)dialog.scrollTop=position;});
}
function renderDetailState(state){
 restoringDetail=true;
 try{if(state.detail==='card')openCard(state.id);else if(state.detail==='deck')openDeck(state.id);else if(state.detail==='local')openMyDeck(state.id,state.detailMode||'visual');else if(state.detail==='event')openEvent(state.id);}
 finally{restoringDetail=false;}
}
$('#detail').addEventListener('scroll',()=>{if($('#detail').open)detailPositions.set(activeDetailKey,$('#detail').scrollTop);},{passive:true});
$('#detail-back').onclick=()=>{captureDetailPosition();history.back();};
function detailAddLabel(zone,qty){const name=zone==='main'?'Main':'Sideboard';return `<span class="detail-action-full">Add to ${name} (${qty})</span><span class="detail-action-short">${zone==='main'?'Main':'Side'} + (${qty})</span>`;}
function cardRulesMarkup(card){
 return `<section class="card-rules" aria-label="能力テキスト">
 <div class="card-rules-switch" role="group" aria-label="能力テキストの言語">
 <button type="button" data-rules-language="ja" aria-controls="card-rules-ja" aria-pressed="true">JPN-TEXT</button>
 <button type="button" data-rules-language="en" aria-controls="card-rules-en" aria-pressed="false">OracleText</button>
 </div>
 <div aria-live="polite">
 <p id="card-rules-ja" class="oracle" lang="ja">${esc(card.oracleJa||(card.oracle?'日本語テキストは未収録です。':'能力テキストなし'))}</p>
 <p id="card-rules-en" class="oracle" lang="en" hidden>${esc(card.oracle||'No rules text.')}</p>
 </div>
 </section>`;
}
$('#detail-body').addEventListener('click',event=>{
 const button=event.target.closest('button[data-rules-language]');
 if(!button)return;
 for(const option of button.parentElement.querySelectorAll('button[data-rules-language]')){
  const selected=option===button;
  option.setAttribute('aria-pressed',String(selected));
  document.getElementById(option.getAttribute('aria-controls')).hidden=!selected;
 }
});
function openCard(id){
 const c=cardMap.get(id);if(!c)return;
 const related=decks.filter(d=>[...d.main,...d.side].some(l=>l.id===id));
 const subs=subtypes(c);
 showDetail(`<div class="detail-top"><div>${imageMarkup(c)}</div><div>${subs.length?`<p class="detail-subtypes eyebrow">${esc(subs.join(' / '))}</p>`:''}<h1 class="card-detail-name"><span>${esc(cardName(c))}</span>${c.ja?`<span class="card-name-separator">/</span><span class="card-english-title">${esc(c.name)}</span>`:''}</h1><p class="hint"><a href="${esc(c.japaneseNameSource||c.url)}" target="_blank" rel="noopener noreferrer">Scryfallで見る</a></p><p>${esc(c.type.split(' // ').map(face=>face.split(' — ')[0]).join(' // '))}</p>${cardRulesMarkup(c)}</div></div><h2>このカードを使う掲載デッキ</h2>${related.length?related.map(d=>`<p class="related-deck"><button class="link-button" data-deck="${d.id}">${esc(d.name)}</button><span class="related-deck-info">${esc(d.author)} · ${confirmedDeckDate(d)?`開催日：<time datetime="${confirmedDeckDate(d)}">${confirmedDeckDate(d)}</time>`:'開催日未登録'}</span> ${d.sample?'<span class="badge">サンプル</span>':''}</p>`).join(''):'<p>掲載デッキには採用例がありません。</p>'}`,'card',id);
}

async function copyPublishedDeck(button){
 const feedback=$('#detail-feedback');button.disabled=true;
 try{await navigator.clipboard.writeText(deckText(decks.find(d=>d.id===button.dataset.copy)));if(button.isConnected){button.textContent='Copied ✓';button.classList.add('is-copied');feedback.textContent='英語デッキリストをコピーしました。';feedback.hidden=false;setTimeout(()=>{if(button.isConnected){button.textContent='Copy';button.classList.remove('is-copied');}},3000);}}
 catch{if(button.isConnected){feedback.textContent='コピーできませんでした。Downloadをご利用ください。';feedback.hidden=false;}}
 finally{if(button.isConnected)button.disabled=false;}
}
function deckText(d){return d.englishText;}
function visualDeckLines(lines,grouped=true,editZone=null){
 const groups=groupDeckLines(lines,cardMap);
 const grid=rows=>`<div class="deck-card-grid">${rows.map(l=>{const c=cardMap.get(l.id),selected=editZone&&selectedWorkbenchCard?.id===l.id&&selectedWorkbenchCard.zone===editZone;return `<article><button type="button" class="card-image-button" ${editZone?`data-workbench-select="${esc(c.id)}" data-zone="${editZone}" aria-pressed="${!!selected}" aria-controls="workbench-selection"`:`data-card="${esc(c.id)}"`} aria-label="${esc(cardCaption(c))}、${l.qty}枚 — ${editZone?'Edit '+zones[editZone]:'Card Details'}">${imageMarkup(c,false,l.qty)}</button></article>`;}).join('')}</div>`;
 if(!lines.length)return '<p class="deck-board-empty">カードはありません。</p>';
 if(!grouped){const merged=new Map(groups.flatMap(g=>g.lines).map(line=>[line.id,line]));return grid([...new Set(lines.map(line=>line.id))].map(id=>merged.get(id)));}
 return groups.filter(group=>group.lines.length).map(group=>`<section class="deck-card-group" aria-label="${group.label}"><h3>${group.label}: ${group.total}</h3>${grid(group.lines)}</section>`).join('');
}
function deckBoard(lines,zone,editing=false){
 const labels={main:'Mainboard',side:'Sideboard',maybe:'Maybe'};
 return `<section class="deck-board" data-board="${zone}"><h2>${labels[zone]}: ${lines.reduce((sum,line)=>sum+line.qty,0)}</h2>${visualDeckLines(lines,zone==='main',editing?zone:null)}</section>`;
}
function openDeck(id){const d=decks.find(d=>d.id===id);if(!d)return;showDetail(`<div class="published-deck-heading"><div class="published-deck-title"><h1>${esc(d.name)}</h1>${deckDateMarkup(confirmedDeckDate(d))}</div><div class="published-deck-player"><span class="eyebrow">PLAYER</span><p>${esc(d.author)}</p><div class="tags">${tags(d.colors)}<span class="tag">${esc(d.archetype)}</span></div></div><div class="published-deck-event"><span class="eyebrow">EVENT / RESULT</span><p><strong>${esc(d.event)} · ${esc(d.result)}</strong><br>${esc(d.venue)}</p></div></div>${deckBoard(d.main,'main')}${deckBoard(d.side,'side')}`,'deck',id);}
const parsedDeckCache=new WeakMap();
function parsedLocalDeck(d){const hit=parsedDeckCache.get(d);if(hit?.map===cardMap&&hit.text===d.text)return hit.value;const value=parseDeck(d.text,cardMap);parsedDeckCache.set(d,{map:cardMap,text:d.text,value});return value;}
function renderMy(){renderBuilder(); $('#my-count').textContent=local.decks.length;const q=normalize(field('my-query'));const rows=local.decks.filter(d=>normalize(d.name).includes(q)).sort((a,b)=>field('my-sort')==='name'?a.name.localeCompare(b.name,'ja'):b.updated.localeCompare(a.updated));if(storageOk){$('#my-status').textContent=`${rows.length} / ${local.decks.length} 件 · このブラウザだけに保存`;}$('#my-results').innerHTML=rows.map(d=>deckTile(d,{localDeck:true})).join('')||(local.decks.length?empty('条件に合うマイデッキはありません','my'):'<div class="empty"><h2>マイデッキはまだありません</h2><p>保存したデータはこのブラウザだけに残ります。</p><button class="primary" id="empty-new">+ New Deck</button></div>');}
function openMyDeck(id,mode='visual'){
 const d=local.decks.find(x=>x.id===id);if(!d)return;const parsed=parsedLocalDeck(d);
 const main=parsed.rows.filter(x=>x.zone==='main'),side=parsed.rows.filter(x=>x.zone==='side'),maybe=parsed.rows.filter(x=>x.zone==='maybe');
 showDetail(`<h1>${esc(d.name)}</h1><div class="actions"><button data-local-view="${esc(id)}" aria-pressed="${mode==='visual'}">Visual</button><button data-local-text="${esc(id)}" aria-pressed="${mode==='text'}">Text</button><button data-edit="${esc(id)}">Edit Deck</button><button data-local-copy="${esc(id)}" aria-label="${esc(d.name)}をMy Deckとして複製">Copy</button><button data-local-export="${esc(id)}">Export MO</button></div>${mode==='text'?`<pre class="raw-deck">${esc(d.text)}</pre>`:deckBoard(main,'main')+deckBoard(side,'side')+`<details class="maybe-candidates"><summary>MAYBE · 検討中</summary>${visualDeckLines(maybe,false)}</details>${parsed.unknown.length?`<h2>読み取れなかった行 ${parsed.unknown.length}件</h2><ol class="unknown-lines">${parsed.unknown.map(x=>`<li value="${x.line}"><code>${esc(x.text)}</code></li>`).join('')}</ol>`:''}`}`,'local',id,mode);
}
function refreshDetail(){const state=history.state;if(!$('#detail').open||!state?.detail)return;captureDetailPosition();renderDetailState(history.state);}
function draftSnapshot(){return Object.fromEntries(['id','name','text','note'].map(k=>[k,field('edit-'+k)]));}
function draftDirty(){return draftActive&&JSON.stringify(draftSnapshot())!==JSON.stringify(draftBase);}
const draftShelf=new Map();
let selectedWorkbenchCard=null,selectionDeckId=null;
let builderZone='main',draftWrite=Promise.resolve(),savingDeck=false,deckStore=null;
let draftOwner;try{draftOwner=sessionStorage.getItem('atlantis.draft.owner')||uuid();sessionStorage.setItem('atlantis.draft.owner',draftOwner);}catch{draftOwner=uuid();}
function draftKey(id=field('edit-id')){return draftOwner+':'+(id||'new');}
function clearDraftRecovery(){try{sessionStorage.removeItem(DRAFT_SESSION);}catch{}}
function saveDraftRecovery(){
 if(!draftActive)return;
 const key=draftKey(),record={key,version:1,draft:draftSnapshot(),base:structuredClone(draftBase),revision:draftRevision,baseline:draftStorageBaseline,updated:new Date().toISOString()};
 try{sessionStorage.setItem(DRAFT_SESSION,JSON.stringify(record));}catch{}
 if(draftDirty()||!local.decks.some(d=>d.id===field('edit-id'))){
  draftShelf.set(key,record);
  draftWrite=draftWrite.catch(()=>{}).then(()=>deckStore?.putDraft(key,record)).catch(()=>{$('#draft-save-status').textContent='下書きを退避できません。Textから本文をコピーしてください。';});
 }else{
  draftShelf.delete(key);draftWrite=draftWrite.catch(()=>{}).then(()=>deckStore?.deleteDraft(key));clearDraftRecovery();
 }
 renderDraftList();
}
function renderDraftList(){
 $('#my-draft-list').innerHTML=[...draftShelf.values()].map(r=>`<button type="button" data-resume-key="${esc(r.key)}">Resume: ${esc(r.draft.name||'無題のデッキ')}<small> · 下書き</small></button>`).join('');
 $('#my-draft-note').hidden=!draftActive;
}
function restoreWorkbenchDraft(record){
 if(draftActive)saveDraftRecovery();
 const r=validateDraftRecovery(record);
 for(const k of ['id','name','text','note'])$('#edit-'+k).value=r.draft[k];
 draftBase=r.base;draftRevision=r.revision;draftStorageBaseline=r.baseline;draftActive=true;draftEpoch++;pendingDraft=null;saveDraftRecovery();
 $('#draft-recovery').hidden=true;poolUndo=[];navigate('cards');renderBuilder();openPool();
}
async function startDraft(id){
 if(draftActive&&(!id||id===field('edit-id')))return;
 if(draftActive)saveDraftRecovery();
 await draftWrite;
 const existing=id&&(draftShelf.get(draftKey(id))||[...draftShelf.values()].filter(r=>r.draft.id===id).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''))[0]);
 if(existing){restoreWorkbenchDraft(existing);return;}
 const d=local.decks.find(x=>x.id===id),data=d||{id:uuid(),name:'無題のデッキ',text:'',note:''};
 for(const k of ['id','name','text','note'])$('#edit-'+k).value=data[k];
 draftActive=true;draftEpoch++;draftBase=draftSnapshot();draftRevision=d?.updated||null;draftStorageBaseline=storageBaseline;poolUndo=[];
 $('#save-error').textContent='';$('#paste-status').textContent='';saveDraftRecovery();renderBuilder();
}
async function editor(id){try{await startDraft(id);navigate('cards');renderBuilder();openPool();}catch(error){message(error.message);}}
async function leaveDetailForEdit(){
 if(!$('#detail').open)return;
 if(!history.state?.detailDepth){closeDetail();return;}
 await new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});closeDetail();});
}
let workbenchStowed=false;
function syncWorkbenchLayout(){
 const pane=$('#builder'),wide=matchMedia('(min-width:1100px)').matches;
 if(currentView!=='cards'||!draftActive||workbenchStowed){if(pane.open)pane.close();$('#pool-toggle').setAttribute('aria-expanded','false');return;}
 if(wide){if(pane.matches(':modal'))pane.close();if(!pane.open)pane.show();}
 else if(pane.open&&!pane.matches(':modal'))pane.close();
 $('#pool-toggle').setAttribute('aria-expanded',String(pane.open));
}
function openPool(){
 if(!draftActive){editor();return;}
 workbenchStowed=false;
 poolOpener=document.activeElement;syncWorkbenchLayout();
 if(!matchMedia('(min-width:1100px)').matches&&!$('#builder').open)$('#builder').showModal();
 $('#pool-toggle').setAttribute('aria-expanded','true');
}
function closePool(){
 workbenchStowed=true;
 syncWorkbenchLayout();
 if(poolOpener?.isConnected)poolOpener.focus({preventScroll:true});
}
function renderBuilder(){
 const activeControl=$('#workbench-selection').contains(document.activeElement)?document.activeElement:null;
 const focusLabel=activeControl?.getAttribute('aria-label');
 $$('[data-deck-add-actions]').forEach(actions=>actions.hidden=!draftActive);
 const parsed=parseDeck(field('edit-text'),cardMap);cardPool=draftActive?parsed.rows:[];
 $('#workbench-name').value=draftActive?field('edit-name'):'';
 $('#pool-toggle').textContent=draftActive?'Deck Editor · '+(field('edit-name')||'無題のデッキ'):'Start a Deck';
 $('#workbench-target').textContent=draftActive?'追加先：'+(field('edit-name')||'無題のデッキ'):'Start a Deckから編集を開始すると、カードを追加できます';
 $('#workbench-status').textContent=!draftActive?'未保存':draftDirty()?'変更あり':local.decks.some(d=>d.id===field('edit-id'))?'保存済み':'未保存';
 $('#workbench-maybe-note').hidden=builderZone!=='maybe';
 const totals={main:0,side:0,maybe:0};
 for(const row of cardPool)totals[row.zone]+=row.qty;
 for(const button of $$('#workbench-tabs button')){
  const zone=button.dataset.workbenchZone;
  button.setAttribute('aria-pressed',String(zone===builderZone));
  button.textContent=zone.toUpperCase()+': '+totals[zone];
 }
 if(selectionDeckId!==field('edit-id')){selectedWorkbenchCard=null;selectionDeckId=field('edit-id');}
 const selected=selectedWorkbenchCard&&cardPool.find(row=>row.id===selectedWorkbenchCard.id&&row.zone===selectedWorkbenchCard.zone);
 if(!selected)selectedWorkbenchCard=null;
 const pool=$('#builder-pool'),scrollTop=pool.scrollTop,maybeOpen=pool.querySelector('.maybe-candidates')?.open;
 pool.innerHTML=deckBoard(cardPool.filter(x=>x.zone==='main'),'main',true)+deckBoard(cardPool.filter(x=>x.zone==='side'),'side',true)+`<details class="maybe-candidates" ${maybeOpen||builderZone==='maybe'?'open':''}><summary>Maybe: ${totals.maybe} · 検討中</summary>${deckBoard(cardPool.filter(x=>x.zone==='maybe'),'maybe',true)}</details>`;
 pool.scrollTop=scrollTop;
 const selection=$('#workbench-selection');selection.hidden=!selected;
 if(selected){
  const c=cardMap.get(selected.id),zone=selected.zone;
  const moves=destinations[zone].map(([to])=>`<button type="button" data-workbench-move="${esc(c.id)}" data-zone="${zone}" data-to="${to}" aria-label="${esc(cardName(c))}を1枚${zones[to]}へ移動">${to==='main'?'←':'→'} ${zones[to]}</button>`).join('');
  selection.innerHTML=`
   <div class="selection-heading">
    <strong>${esc(cardName(c))} · ${zones[zone]}</strong>
    <button type="button" data-workbench-deselect aria-label="カードの選択を解除">×</button>
   </div>
   <div class="selection-actions">
    <div class="selection-quantity" role="group" aria-label="枚数変更">
     <button type="button" data-workbench-adjust="${c.id}" data-zone="${zone}" data-delta="-1" aria-label="${esc(cardName(c))}を1枚減らす">−</button>
     <input type="number" min="0" max="1000" step="1" inputmode="numeric" value="${selected.qty}" data-workbench-qty="${c.id}" data-zone="${zone}" aria-label="${esc(cardName(c))}の${zones[zone]}枚数">
     <button type="button" data-workbench-adjust="${c.id}" data-zone="${zone}" data-delta="1" aria-label="${esc(cardName(c))}を1枚増やす">+</button>
    </div>
    <div class="selection-moves" role="group" aria-label="1枚移動">${moves}</div>
    <button type="button" data-card="${c.id}">Details</button>
    <button type="button" class="danger" data-workbench-remove="${c.id}" data-zone="${zone}" aria-label="${esc(cardName(c))}を${zones[zone]}から削除">Delete</button>
   </div>`;
 }else selection.replaceChildren();
 if(focusLabel&&selected){[...selection.querySelectorAll('[aria-label]')].find(el=>el.getAttribute('aria-label')===focusLabel)?.focus({preventScroll:true});}
 $('#workbench-unknown').hidden=!parsed.unknown.length;
 $('#workbench-unknown-count').textContent=parsed.unknown.length;
 $('#workbench-undo').disabled=!poolUndo.length;
 $('#workbench-save').disabled=!draftActive||savingDeck||!storageOk;
 renderDraftList();syncWorkbenchLayout();
}
function commitWorkbenchText(text,label){
 if(text===field('edit-text'))return;
 poolUndo.push(field('edit-text'));if(poolUndo.length>30)poolUndo.shift();
 $('#edit-text').value=text;saveDraftRecovery();renderBuilder();message(label,undoWorkbench);
}
function undoWorkbench(){if(!poolUndo.length)return;$('#edit-text').value=poolUndo.pop();saveDraftRecovery();renderBuilder();message('直前の操作を戻しました。');}
async function addToPool(id,zone){
 try{
  if(!draftActive)throw new Error('Start a Deckから編集を開始してください。');
  if(!zones[zone])throw new Error('追加先を確認してください。');
  await startDraft();const qty=parseDeck(field('edit-text'),cardMap).rows.find(x=>x.id===id&&x.zone===zone)?.qty||0;
  commitWorkbenchText(setDeckQuantity(field('edit-text'),cardMap,id,zone,qty+1),`${cardName(cardMap.get(id))}を${zones[zone]}へ追加しました。`);
  refreshDetail();
 }catch(error){message(error.message);}
}
function checkDraftRecovery(){
 if(draftActive)return;
 try{
  const raw=sessionStorage.getItem(DRAFT_SESSION),source=raw?JSON.parse(raw):null,session=source?{...validateDraftRecovery(source),key:source.key}:null;
  pendingDraft=session||[...draftShelf.values()].sort((a,b)=>(b.updated||'').localeCompare(a.updated||''))[0];
  $('#draft-recovery').hidden=!pendingDraft;renderDraftList();
 }catch{$('#draft-recovery').hidden=false;$('#draft-recover').disabled=true;$('#draft-recovery-text').textContent='未保存テキストを読み取れません。保存済みデータは保持しています。';}
}
function assertDraftRevision(){if(draftActive&&((field('edit-id')&&(local.decks.find(d=>d.id===field('edit-id'))?.updated||null)!==draftRevision)))throw new Error('編集開始後に保存内容が変わりました。Reload Decksで確認するかSave as Newをご利用ください。');}
async function saveWorkbench(asNew=false){
 if(!draftActive||savingDeck)return;
 savingDeck=true;renderBuilder();
 try{
  await workbenchAction;await draftWrite;
  if(asNew)await readLocal();else assertDraftRevision();
  const name=field('edit-name').trim();if(!name)throw new Error('デッキ名を入力してください。');
  const savedSnapshot=draftSnapshot(),oldKey=draftKey(),d={...savedSnapshot,id:asNew?uuid():field('edit-id')||uuid(),name,updated:new Date().toISOString()};
  const exists=local.decks.some(x=>x.id===d.id);
  await persist({...local,decks:exists?local.decks.map(x=>x.id===d.id?d:x):[d,...local.decks]});
  // Keep edits made while the asynchronous save was running in the editor.
  $('#edit-id').value=d.id;draftBase={id:d.id,name:d.name,text:d.text,note:d.note};draftRevision=d.updated;draftStorageBaseline=storageBaseline;
  draftShelf.delete(oldKey);await deckStore.deleteDraft(oldKey);clearDraftRecovery();
  const unchanged=['name','text','note'].every(k=>field('edit-'+k)===savedSnapshot[k]);
  if(unchanged){draftActive=false;draftEpoch++;poolUndo=[];closePool();if($('#editor').open)$('#editor').close();}
  else saveDraftRecovery();
  renderMy();message(unchanged?'このブラウザに保存しました。編集を終了しました。':'保存しました。保存中に加えた変更は編集中のまま保持しています。');
 }catch(error){$('#save-error').textContent=error.message+' 入力は保持しています。';message(error.message);}
 finally{savingDeck=false;renderBuilder();}
}

async function copyLocalDeck(id,button){
 if(button)button.disabled=true;
 try{await readLocal();const source=local.decks.find(d=>d.id===id);if(!source)throw new Error('複製元のデッキを再読込してください。');
  const copy={...source,id:uuid(),name:source.name.slice(0,193)+' (Copy)',updated:new Date().toISOString()};
  await persist({...local,decks:[copy,...local.decks]});renderMy();message('My Decksに複製しました。');
 }catch(error){message(error.message);}finally{if(button?.isConnected)button.disabled=false;}
}
function exportLocalDeck(id){try{const d=local.decks.find(d=>d.id===id);if(!d)return;download(officialDeckText(d.text,cardMap),d.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_')+'.txt');}catch(error){message(error.message);}}
function backup(decks=local.decks){return createBackup(decks);}
function download(text,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportBackup(rows=local.decks){try{await draftWrite;const drafts=rows===local.decks?[...draftShelf.values()].filter(r=>JSON.stringify(r.draft)!==JSON.stringify(r.base)||!local.decks.some(d=>d.id===r.draft.id)).map(r=>({...r.draft,id:uuid(),name:(r.draft.name||'無題のデッキ')+'（下書き）',updated:r.updated||new Date().toISOString()})):[];download(JSON.stringify(backup([...rows,...drafts]),null,2),'atlantis-mydecks-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8');message('保存済みデッキと下書きのバックアップを書き出しました。');}catch(error){message(error.message);}}
function reset(kind){if(kind==='cards'){for(const id of ['card-name','card-oracle','card-keyword'])$('#'+id).value='';$$('#card-colors input,#card-types input').forEach(x=>x.checked=false);clearManaBound('card-min');clearManaBound('card-max');$('#card-color-mode').value='includes';cardPage=1;renderCards();}else if(kind==='decks'){for(const id of ['deck-query','deck-archetype','deck-card'])$('#'+id).value='';selectedCards=[];$('#deck-side').checked=false;$('#deck-color-mode').value='includes';$$('#deck-colors input').forEach(x=>x.checked=false);renderDecks();}else{$('#my-query').value='';renderMy();}saveSearch();}
function allResults(){renderDecks();renderCards();renderMy();renderResults();}
function searchFor(kind){if(composing)return;if(kind==='cards'){cardPage=1;renderCards();}else renderDecks();saveSearch();}
async function load(){loadFailed=false;$('#load-status').className='';$('#load-status').textContent='データを読み込んでいます…';try{const [c,d]=await Promise.all([
 loadCatalogFile('data/cards.json',data=>data?.meta?.paginationComplete===true&&Array.isArray(data.cards)&&data.cards.length>0&&data.cards.length===data.meta.count),
 loadCatalogFile('data/decks.json',Array.isArray).catch(()=>null),
]);deckLoadFailed=d===null;meta=c.meta;cards=c.cards.map(prepare);const manaLimit=Math.max(1,...cards.map(card=>Math.ceil(card.mv)));for(const id of ['card-min','card-max'])$('#'+id).max=String(manaLimit);$('#card-min').value='0';$('#card-max').value=String(manaLimit);syncManaSliders();renderManaTicks(manaLimit);cardMap=new Map(cards.map(c=>[c.id,c]));decks=d??decks;renderGuideDeckLinks();renderResults();$('#deck-sample-notice').hidden=!decks.some(d=>d.sample);$('#card-suggestions').innerHTML=cards.map(c=>`<option value="${esc(c.ja||c.name)}" label="${esc(c.name)}"></option>${c.ja?`<option value="${esc(c.name)}" label="${esc(c.ja)}"></option>`:''}`).join('');$('#deck-suggestions').innerHTML=decks.map(d=>`<option value="${esc(d.name)}"></option>`).join('');$('#deck-archetype').innerHTML='<option value="">All</option>'+[...new Set(decks.map(d=>d.archetype))].map(t=>`<option>${esc(t)}</option>`).join('');restoreSearch();searchReady=true;$('#load-status').textContent='';allResults();checkDraftRecovery();navigate(location.hash.slice(1)||'home');renderFeatured();}catch(e){loadFailed=true;$('#load-status').className='status-error';$('#load-status').innerHTML=(navigator.onLine?'カードデータの読込に失敗しました。検索条件は保持しています。':'保存済みのカードデータがありません。オンラインでカード一覧を開いてください。My Decksはテキスト入力で編集できます。')+'<button id="load-retry">再試行</button>';allResults();}}

colorControls('card');colorControls('deck');$('#card-types .type-checks').innerHTML=Object.keys(types).filter(en=>en!=='Planeswalker').map(en=>`<label><input id="card-type-${en}" type="checkbox" value="${en}"><span>${en}</span></label>`).join('');$('#language-help').innerHTML='<strong>能力語</strong><p>'+esc(Object.keys(oracleWords).join(' / '))+'</p><strong>サブタイプ</strong><p>'+esc(Object.values(subtypeNames).join(' / '))+'</p>';
for(const aside of $$('.filters')){const prefix=aside.querySelector('#card-colors')?'card':'deck';const colors=$('#'+prefix+'-colors');const mode=$('#'+prefix+'-color-mode').closest('label');const basic=document.createElement('div');basic.className='basic-filters';basic.append(colors,mode);const content=document.createElement('div');content.className='filter-body';while(aside.firstChild)content.append(aside.firstChild);aside.append(basic,content);aside.classList.add('collapseable');const b=document.createElement('button');b.type='button';b.className='filter-toggle';b.textContent='Filters';b.setAttribute('aria-expanded','false');b.onclick=()=>{const open=aside.classList.toggle('open');b.setAttribute('aria-expanded',String(open));};aside.insertBefore(b,content);}
document.addEventListener('compositionstart',()=>composing=true);document.addEventListener('compositionend',()=>composing=false);
$('#deck-form').onsubmit=e=>{e.preventDefault();searchFor('decks');};$('#card-form').onsubmit=e=>{e.preventDefault();searchFor('cards');};$('#add-card').onclick=addDeckCard;$('#deck-card').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&!composing){e.preventDefault();addDeckCard();}};
// Shared permanent search sidebar; stack above results on smaller screens.
for(const kind of ['decks','cards']){
 const view=$('#view-'+kind),prefix=kind==='decks'?'deck':'card',form=$('#'+prefix+'-form'),filters=view.querySelector('.filters'),toolbar=view.querySelector('.toolbar'),workspace=view.querySelector('.workspace');
 const controls=document.createElement('div');controls.className='search-controls search-sidebar '+prefix+'-search-sidebar';form.before(controls);
 const basic=filters.querySelector('.basic-filters'),body=filters.querySelector('.filter-body'),toggle=filters.querySelector('.filter-toggle');
 const colorRow=document.createElement('div');colorRow.className='search-color-row';colorRow.append(basic,$('#'+prefix+'-sort').closest('label'));
 body.id=prefix+'-filter-body';
 const layout=document.createElement('div');layout.className='card-browser search-browser';controls.before(layout);layout.append(controls,workspace);
 controls.setAttribute('role','search');controls.setAttribute('aria-label',(kind==='decks'?'デッキ':'カード')+'検索と絞り込み');
 form.classList.add('card-search');
 const help=document.createElement('details');help.className='search-help';const summary=document.createElement('summary');summary.textContent='検索方法';help.append(summary);
 body.querySelector('h2').remove();toggle.remove();filters.classList.remove('collapseable');
 const actions=document.createElement('div');
 actions.className='card-search-actions';
 actions.append(form.querySelector('button[type="submit"]'),body.querySelector('[data-reset="'+kind+'"]'));
 form.append(actions);
 if(kind==='cards'){
  basic.querySelector('#card-colors').after(basic.querySelector('label:has(#card-color-mode)'),$('#card-types'));

  colorRow.append(toolbar.querySelector('.display'));
  help.append(form.querySelector('.hint'),body.querySelector('.hint'),view.querySelector('.language-help'));
  const topPages=document.createElement('div');topPages.id='card-pages-top';topPages.className='pagination card-pagination';topPages.setAttribute('aria-label','検索結果のページ送り（上部）');
  toolbar.append(topPages);
 }else{
  help.append(body.querySelector('.hint'));
 }
 controls.append(form,colorRow,filters,help);filters.append(body);
 workspace.querySelector('.results-area').prepend(toolbar);
}
const searchSwitches=[];
for(const [id,label] of [['deck-color-mode','Color Match'],['card-color-mode','Color Match'],['card-display','Display']]){
 const select=$('#'+id), container=select.closest('label');
 const button=document.createElement('button');
 button.type='button';
 button.className='search-switch';
 button.setAttribute('role','switch');
 button.setAttribute('aria-label',label+' · '+select.options[1].text);
 for(const option of select.options){
  const segment=document.createElement('span');
  segment.textContent=option.text;
  button.append(segment);
 }
 button.onclick=()=>{
  select.selectedIndex=select.selectedIndex===0?1:0;
  syncSearchSwitches();
  select.dispatchEvent(new Event('change'));
 };
 select.hidden=true;
 const group=document.createElement('div');
 group.className=container.className+' search-switch-field';
 if(id==='card-color-mode')group.classList.add('card-color-switch');
 container.replaceWith(group);
 group.append(label,select,button);
 searchSwitches.push({select,button});
}
function syncSearchSwitches(){
 for(const {select,button} of searchSwitches)button.setAttribute('aria-checked',String(select.selectedIndex===1));
}
syncSearchSwitches();
const cardBrowser=$('#view-cards .card-browser'),workbenchLayout=document.createElement('div');workbenchLayout.className='workbench-layout';cardBrowser.before(workbenchLayout);workbenchLayout.append(cardBrowser,$('#builder'));
for(const sel of ['#deck-colors input','#deck-color-mode','#deck-archetype','#deck-side','#deck-sort'])$$(sel).forEach(x=>x.addEventListener('change',()=>searchFor('decks')));
for(const sel of ['#card-colors input','#card-types input','#card-color-mode','#card-sort'])$$(sel).forEach(x=>x.addEventListener('change',()=>searchFor('cards')));
for(const input of [$('#card-min'),$('#card-max')])input.addEventListener('input',()=>{syncManaSliders(input.id);searchFor('cards');});
$('#card-display').onchange=()=>{renderCards();saveSearch();};
$('#my-query').oninput=()=>{if(!composing)renderMy();};$('#my-query').addEventListener('compositionend',renderMy);$('#my-sort').onchange=renderMy;
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.buildCard){workbenchAction=workbenchAction.catch(()=>{}).then(()=>addToPool(b.dataset.buildCard,b.dataset.buildZone));await workbenchAction;}if(b.id==='detail-open-storage'){await leaveDetailForEdit();await editor();}if(b.dataset.view)navigate(b.dataset.view);if(b.dataset.deck)openDeck(b.dataset.deck);if(b.dataset.card)openCard(b.dataset.card);if(b.dataset.event)openEvent(b.dataset.event);if(b.dataset.reset)reset(b.dataset.reset);if(b.dataset.removeCard){selectedCards=selectedCards.filter(id=>id!==b.dataset.removeCard);renderDecks();saveSearch();}if(b.dataset.removeColor){const[prefix,color]=b.dataset.removeColor.split(':');$(`#${prefix}-colors input[value="${color}"]`).checked=false;searchFor(prefix==='card'?'cards':'decks');}if(b.dataset.removeType){const x=$$('#card-types input').find(x=>x.value===b.dataset.removeType);if(x)x.checked=false;searchFor('cards');}if(b.dataset.removeField){const x=$('#'+b.dataset.removeField);if(x){if(['card-min','card-max'].includes(x.id))clearManaBound(x.id);else x.value='';searchFor(b.dataset.removeField.startsWith('card')?'cards':'decks');}}if(b.dataset.page){cardPage=Number(b.dataset.page);renderCards();saveSearch();$('#card-result-count').scrollIntoView({block:'start'});}if(b.dataset.close){if(b.dataset.close==='detail')closeDetail();else $('#'+b.dataset.close).close();}if(['new-deck','empty-new'].includes(b.id))editor();if(b.dataset.localView)openMyDeck(b.dataset.localView);if(b.dataset.localText)openMyDeck(b.dataset.localText,'text');if(b.dataset.edit){await leaveDetailForEdit();await editor(b.dataset.edit);}if(b.dataset.delete){pendingDelete=b.dataset.delete;const d=local.decks.find(x=>x.id===pendingDelete);$('#confirm-text').textContent=`「${d.name}」をこのブラウザの一覧から削除します。`;$('#confirm-dialog').showModal();}if(b.dataset.localCopy)await copyLocalDeck(b.dataset.localCopy,b);if(b.dataset.localExport)exportLocalDeck(b.dataset.localExport);if(b.dataset.download){const d=decks.find(d=>d.id===b.dataset.download);download(deckText(d),d.id+'.txt');}if(b.dataset.copy)await copyPublishedDeck(b);if(b.id==='load-retry')load();});
$('#editor-form').onsubmit=e=>{e.preventDefault();saveWorkbench();};
$('#confirm-delete').onclick=async()=>{try{const d=local.decks.find(x=>x.id===pendingDelete);if(!d)return;await persist({...local,decks:local.decks.filter(x=>x.id!==d.id),trash:[...local.trash,d]});$('#confirm-dialog').close();renderMy();message('マイデッキを削除しました。',async()=>{try{await persist({...local,decks:[d,...local.decks],trash:local.trash.filter(x=>x.id!==d.id)});renderMy();message('元に戻しました。');}catch{message('復元できませんでした。保存設定を確認してください。');}});}catch{message('削除を保存できませんでした。データは変更していません。');}};
$('#backup').onclick=()=>exportBackup();$('#restore-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('10MB以内のバックアップを選んでください。');const data=JSON.parse(await file.text());const next=appendBackup(local,data);const added=next.decks.length-local.decks.length;await persist(next);renderMy();message(`${added}件を追加して復元しました。既存データは保持しています。`);}catch(err){message('読み込めませんでした：'+err.message);}finally{e.target.value='';}};
$('#detail').addEventListener('cancel',e=>{e.preventDefault();closeDetail();});window.addEventListener('popstate',e=>{if(e.state?.detail)renderDetailState(e.state);else if($('#detail').open){$('#detail').close();if(detailOpener?.isConnected)detailOpener.focus({preventScroll:true});}});window.addEventListener('hashchange',()=>{if($('#menu-dialog').open)$('#menu-dialog').close();navigate(location.hash.slice(1));});
$('#test-error').onclick=()=>{saveSearch();loadFailed=true;$('#load-status').className='status-error';$('#load-status').innerHTML='検証用：通信失敗を表示しています。ローカル保存データは利用できます。<button id="load-retry">再試行</button>';renderCards();renderDecks();};$('#retry-load').onclick=load;$('#hide-images').onchange=e=>{hideImages=e.target.checked;allResults();refreshDetail();};

function entryLink(event){const url=externalEntryUrl(event.entryUrl);return url?`<a class="file-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(event.entryLabel||'外部の申込先を開く')} ↗</a>`:'<span class="badge">申込先未設定</span>';}
function eventFields(e){return `<dl class="event-facts"><dt>開催日時（日本時間）</dt><dd><time ${e.start?`datetime="${esc(e.start)}"`:''}>${esc(eventDate(e.start))}</time>〜<br><time ${e.end?`datetime="${esc(e.end)}"`:''}>${esc(eventDate(e.end))}</time></dd><dt>会場</dt><dd>${esc(e.venue||'未定')}</dd><dt>参加費</dt><dd>${esc(e.fee||'未定')}</dd><dt>大会形式</dt><dd>${esc(e.format||'未定')}</dd></dl>`;}
function eventAnnouncementTile(event){
 return `<article class="deck-card featured-card event-tile event-announcement"><button class="featured-open" type="button" data-event="${esc(event.id)}" aria-label="${esc(event.title)}の大会案内">${eventPlaceholder('UPCOMING EVENT')}<div class="content"><span class="eyebrow">EVENT GUIDE</span><h3>${esc(event.title)}</h3><dl class="event-card-facts"><div><dt>開催日時</dt><dd><time datetime="${esc(event.start)}">${esc(eventDate(event.start))}</time><span class="event-timezone">日本時間</span></dd></div><div><dt>会場</dt><dd>${esc(event.venue||'未定')}</dd></div><div><dt>参加費</dt><dd>${esc(event.fee||'未定')}</dd></div><div><dt>大会形式</dt><dd>${esc(event.format||'未定')}</dd></div></dl><span class="event-card-action">Details / Rules →</span></div></button></article>`;
}
function renderEvents(){
 const status=$('#event-count'),target=$('#event-results'),listStatus=$('#event-announcement-count'),list=$('#event-announcement-list'),more=$('#event-announcements-more');
 more.hidden=true;
 if(eventLoadState==='loading'||eventLoadState==='error'){
  status.textContent=listStatus.textContent=eventLoadState==='loading'?'大会案内を読み込んでいます…':'大会案内を読み込めませんでした。';
  target.innerHTML=list.innerHTML=eventLoadState==='error'?'<div class="empty"><button data-event-retry>大会案内を再読込</button></div>':'';return;
 }
 const listed=events.filter(e=>!e.sample).sort((a,b)=>eventSortKey(a)-eventSortKey(b)||a.id.localeCompare(b.id));
 const empty='<div class="empty"><h2>大会案内はまだありません</h2><p>日時、会場、参加方法などの正式な情報が決まり次第ご案内します。</p><a href="#decks">Decksを見る →</a></div>';
 status.textContent=listed.length?`${Math.min(6,listed.length)} / ${listed.length} 件`:'';
 listStatus.textContent=`${listed.length} 件`;
 target.innerHTML=listed.slice(0,6).map(eventAnnouncementTile).join('')||empty;
 list.innerHTML=eventRoute(location.hash.slice(1))?.kind==='announcements'?listed.map(eventAnnouncementTile).join('')||empty:'';
 more.hidden=listed.length<=6;
}
function openEvent(id){const event=events.find(e=>e.id===id);if(!event)return;showDetail(`${event.sample?'<span class="badge">架空のサンプル・実際の受付なし</span>':''}<h1>${esc(event.title)}</h1>${eventFields(event)}<h2>会場・住所</h2><p>${esc(event.address)}</p><h2>大会について</h2><p>${esc(event.description)}</p><h2>ルール・注意事項</h2><p class="event-rules">${esc(event.rules)}</p><h2>参加申込の案内</h2><p>参加申込は外部の案内先で行う想定です。ATLANTIS内での申込・キャンセル・定員管理はMVP対象外です。</p><div class="actions">${entryLink(event)}</div><p class="hint">${esc(event.entryNote)}</p>`,'event',id);}
function renderResults(){
 const status=$('#tournament-status'),target=$('#tournament-results'),page=$('#event-result-content'),listStatus=$('#event-directory-count'),list=$('#event-directory-list'),more=$('#event-results-more');
 more.hidden=true;
 const showState=(text,retry=false)=>{
  status.textContent=listStatus.textContent=text;target.innerHTML=list.innerHTML=retry?'<button data-results-retry>大会結果を再読込</button>':'';
  page.innerHTML=`<h1 id="event-result-title">Event Results</h1><p role="status">${esc(text)}</p>${retry?'<button data-results-retry>大会結果を再読込</button>':''}`;
 };
 if(resultLoadState==='loading'||eventLoadState==='loading'){showState('大会結果を読み込んでいます…');return;}
 if(resultLoadState==='error'){showState('大会結果を読み込めませんでした。',true);return;}
 if(deckLoadFailed){showState('掲載デッキを読み込めませんでした。',true);return;}
 if(!cards.length){showState('カードデータを読み込めませんでした。',true);return;}
 const errors=validatePublishingData({cards,events,results:tournamentResults,decks});
 if(errors.length){showState('大会結果の内容を確認できませんでした。',true);return;}
 const groups=collectEventResults(decks,tournamentResults),route=eventRoute(location.hash.slice(1));
 const render=group=>renderEventSummary(group,deck=>{const card=cardMap.get(deck.hero);return card?imageMarkup(card,true):'';});
 const empty='<p class="empty">大会結果はまだありません。</p>';
 status.textContent=groups.length?`${Math.min(6,groups.length)} / ${groups.length} 件`:'';
 listStatus.textContent=`${groups.length} 件`;
 target.innerHTML=groups.slice(0,6).map(render).join('')||empty;
 list.innerHTML=route?.kind==='results'?groups.map(render).join('')||empty:'';
 more.hidden=groups.length<=6;
 if(route?.kind!=='detail')return;
 const group=groups.find(g=>g.id===route.id);
 page.innerHTML=group?renderEventResult(group):'<h1 id="event-result-title">Event Results</h1><p>指定された大会結果は見つかりませんでした。</p>';
}
async function loadEvents(){eventLoadState='loading';renderEvents();try{const r=await fetch('data/events.json',{cache:'no-store'});if(!r.ok)throw new Error('Event fetch error');const data=await r.json();if(validatePublishingData({events:data}).length)throw new Error('Invalid events');events=data;$('#event-sample-notice').hidden=true;eventLoadState='ready';}catch{eventLoadState='error';}renderEvents();renderResults();}
async function loadResults(){resultLoadState='loading';renderResults();try{const r=await fetch('data/results.json',{cache:'no-store'});if(!r.ok)throw new Error('Results fetch error');const data=await r.json();if(!Array.isArray(data))throw new Error('Invalid results');tournamentResults=data;resultLoadState='ready';}catch{resultLoadState='error';}renderResults();}
document.addEventListener('click',async e=>{if(e.target.closest('[data-event-retry]'))loadEvents();if(e.target.closest('[data-results-retry]')){if(deckLoadFailed||!cards.length)await load();loadEvents();loadResults();}});
async function boot(){
 navigate(location.hash.slice(1)||'home');
 try{deckStore=await openDeckStore();await readLocal();for(const r of await deckStore.drafts()){try{validateDraftRecovery(r);draftShelf.set(r.key,r);}catch{message('読み取れない下書きがあります。元の退避データは保持しています。');}}renderMy();}
 catch(error){storageOk=false;message('保存領域を読み込めません。元データを保持しています。'+error.message);}
 await load();loadEvents();loadResults();
}
$('#pool-toggle').onclick=()=>{
 if($('#builder').open)closePool();
 else openPool();
};
$('#pool-close').onclick=closePool;
$('#workbench-add-cards').onclick=()=>{
 closePool();
 navigate('cards');
 $('#card-name').focus();
};
$('#builder').addEventListener('cancel',e=>{e.preventDefault();closePool();});
$('#workbench-name').oninput=e=>{$('#edit-name').value=e.target.value;saveDraftRecovery();$('#workbench-target').textContent='追加先：'+(e.target.value||'無題のデッキ');$('#workbench-status').textContent='変更あり';};
$('#workbench-save').onclick=()=>saveWorkbench();$('#workbench-as-new').onclick=()=>saveWorkbench(true);
$('#workbench-undo').onclick=undoWorkbench;
$('#workbench-text').onclick=()=>{if(!draftActive)return;if($('#builder').matches(':modal'))closePool();$('#editor').showModal();};
$('#workbench-export').onclick=()=>{try{download(officialDeckText(field('edit-text'),cardMap),'atlantis-deck.txt');}catch(error){message(error.message);}};
$('#workbench-reload').onclick=async()=>{try{await readLocal();renderMy();message('保存先を再読込しました。編集中の内容は保持しています。上書きが必要な場合はSave as Newをご利用ください。');}catch(error){message(error.message);}};
$('#workbench-discard').onclick=async()=>{if(draftDirty()&&!window.confirm('未保存の編集を破棄しますか？'))return;const key=draftKey();draftActive=false;renderBuilder();await draftWrite;draftShelf.delete(key);await deckStore?.deleteDraft(key);clearDraftRecovery();closePool();renderBuilder();};
$('#resume-draft').onclick=()=>editor();
$('#draft-recover').onclick=()=>{if(pendingDraft)restoreWorkbenchDraft(pendingDraft);};
$('#draft-forget').onclick=async()=>{if(pendingDraft?.key){draftShelf.delete(pendingDraft.key);await deckStore?.deleteDraft(pendingDraft.key);}pendingDraft=null;clearDraftRecovery();$('#draft-recovery').hidden=true;renderDraftList();};
$('#draft-as-new').onclick=()=>saveWorkbench(true);
$('#discard-draft').onclick=()=>$('#workbench-discard').click();
$('#search-build').onclick=()=>{$('#editor').close();navigate('cards');renderBuilder();openPool();};
for(const k of ['name','text','note'])$('#edit-'+k).addEventListener('input',()=>{saveDraftRecovery();renderBuilder();});
$('#editor').addEventListener('close',()=>{renderBuilder();if(currentView==='cards'&&draftActive)openPool();});
window.addEventListener('resize',syncWorkbenchLayout);
let workbenchAction=Promise.resolve();
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.workbenchZone){builderZone=b.dataset.workbenchZone;if(selectedWorkbenchCard?.zone!==builderZone)selectedWorkbenchCard=null;renderBuilder();$('#builder-pool').querySelector(`[data-board="${builderZone}"]`)?.scrollIntoView({block:'start'});}
 if(b.dataset.workbenchSelect){selectedWorkbenchCard={id:b.dataset.workbenchSelect,zone:b.dataset.zone};builderZone=b.dataset.zone;renderBuilder();$('#workbench-selection button')?.focus({preventScroll:true});}
 if(b.hasAttribute('data-workbench-deselect')){const previous=selectedWorkbenchCard;selectedWorkbenchCard=null;renderBuilder();$$('[data-workbench-select]').find(x=>x.dataset.workbenchSelect===previous?.id&&x.dataset.zone===previous?.zone)?.focus({preventScroll:true});}
 if(b.dataset.resumeKey){const r=draftShelf.get(b.dataset.resumeKey);if(r)restoreWorkbenchDraft(r);}
 try{const id=b.dataset.workbenchMove||b.dataset.workbenchAdjust||b.dataset.workbenchRemove;if(!id)return;const zone=b.dataset.zone;let text=field('edit-text');if(b.dataset.workbenchMove)text=moveDeckCard(text,cardMap,id,zone,b.dataset.to);else{const qty=parseDeck(text,cardMap).rows.find(x=>x.id===id&&x.zone===zone)?.qty||0;text=setDeckQuantity(text,cardMap,id,zone,b.dataset.workbenchRemove?0:qty+Number(b.dataset.delta));}commitWorkbenchText(text,'デッキを変更しました。');}catch(error){message(error.message);}
});
document.addEventListener('change',e=>{const id=e.target.dataset.workbenchQty;if(!id)return;try{commitWorkbenchText(setDeckQuantity(field('edit-text'),cardMap,id,e.target.dataset.zone,Number(e.target.value)),'枚数を変更しました。');}catch(error){message(error.message);renderBuilder();}});
$('#paste-deck').onclick=async()=>{
  const button=$('#paste-deck'),input=$('#edit-text'),before=input.value,start=input.selectionStart,end=input.selectionEnd,epoch=draftEpoch;
  button.disabled=true;$('#paste-status').textContent='';
  try{
    if(!navigator.clipboard?.readText)throw new Error('このブラウザではボタンから読み取れません。本文欄を長押し、またはCtrl+V／⌘Vで貼り付けてください。');
    const text=await navigator.clipboard.readText();
    if(!$('#editor').open||epoch!==draftEpoch||input.value!==before||input.selectionStart!==start||input.selectionEnd!==end)throw new Error('編集中の内容や入力位置が変わりました。入力は保持しています。もう一度貼付ボタンを押してください。');
    if(!text){$('#paste-status').textContent='クリップボードにテキストがありません。本文は変更していません。';return;}
    const next=insertDeckText(before,text,start,end);input.value=next.text;input.focus();input.setSelectionRange(next.caret,next.caret);saveDraftRecovery();
    $('#paste-status').textContent='本文の選択範囲／入力位置に貼り付けました。保存はまだ行っていません。';
  }catch(error){$('#paste-status').textContent=error.name==='NotAllowedError'?'クリップボードの読取りが許可されませんでした。本文欄を長押し、またはCtrl+V／⌘Vで貼り付けてください。':error.message;}
  finally{button.disabled=false;}
};
window.addEventListener('beforeunload',event=>{if(draftDirty()){event.preventDefault();event.returnValue='';}});

for(const dialog of $$('dialog')){let outside=false,pointer=null;const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};const dismiss=()=>{if(dialog.id==='detail')closeDetail();else if(dialog.id==='builder')closePool();else dialog.close();};dialog.addEventListener('pointerdown',e=>{outside=e.button===0&&isOutside(e);pointer=e.pointerId;});dialog.addEventListener('pointerup',e=>{if(canDismissBackdrop(outside&&pointer===e.pointerId,isOutside(e)))dismiss();outside=false;});dialog.addEventListener('pointercancel',()=>outside=false);dialog.addEventListener('close',()=>{outside=false;saveDraftRecovery();});}
$('#printing-mode').value=printingMode;

$('#printing-mode').onchange=()=>{printingMode=field('printing-mode')==='ja'?'ja':'en';try{localStorage.setItem(PRINT_MODE,printingMode);$('#printing-status').textContent='このブラウザの全画面に適用';}catch{$('#printing-status').textContent='保存領域を使えないため、このページ内だけに適用';}allResults();renderFeatured();refreshDetail();};
async function loadPrintings(){if(!navigator.onLine){$('#printing-status').textContent='オフライン中はテキストで表示';return;}try{const response=await fetch('data/printings.json',{cache:'no-store'});if(!response.ok)throw new Error();const d=await response.json();if(!d.meta.complete)throw new Error();printings=d;$('#printing-status').textContent=`表示版データ ${d.meta.snapshotDate} · 規則 v${d.meta.ruleVersion}`;}catch{$('#printing-status').textContent='表示版データの読込失敗。画像を表示できません。';}allResults();renderFeatured();refreshDetail();}
function updateConnectionDisplay(){
 const offline=!navigator.onLine;
 $('#offline-status').hidden=!offline;
 $('#guide-artwork').classList.toggle('offline-artwork',offline);
}
updateConnectionDisplay();
for(const type of ['online','offline'])window.addEventListener(type,()=>{
 updateConnectionDisplay();
 allResults();renderFeatured();refreshDetail();
 if(navigator.onLine&&!printings)loadPrintings();
});
loadPrintings();

function renderFeatured(){
 $('#featured-decks').innerHTML=decks.filter(d=>!d.sample&&d.result).slice().sort((a,b)=>a.order-b.order).slice(0,3).map(d=>deckTile(d)).join('');
}
$('#settings-open').onclick=()=>{$('#settings-dialog').showModal();$(`input[name="printing-choice"][value="${printingMode}"]`).checked=true;};

$('#menu-open').onclick=()=>$('#menu-dialog').showModal();
$$('input[name="printing-choice"]').forEach(input=>input.onchange=()=>{$('#printing-mode').value=input.value;$('#printing-mode').dispatchEvent(new Event('change'));$('#settings-dialog').close();});
for(const id of ['settings-dialog','menu-dialog'])$('#'+id).addEventListener('click',e=>{if(e.target.id===id)$('#'+id).close();});

['card-name','deck-card','deck-query'].forEach(id=>attachAutocomplete($('#'+id)));

fetch('version.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(v=>{$('#site-version').textContent=`rev.${v.count} · ${v.revision}`;$('#site-version').title=`更新：${v.date} / Git履歴に基づく版番号`;}).catch(()=>{$('#site-version').textContent='development';});

registerPwa();
boot();
