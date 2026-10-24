import {normalize,colorNames,types,subtypeNames,oracleWords,subtypes,prepare,cardMatches,deckMatches,createBackup,validateLocalState,appendBackup,eventDate,eventSortKey,validOptionalDate,externalEntryUrl,insertDeckText,stageSearchCard,applyCardPool,setPoolQuantity,movePoolCard,validatePoolRecovery,parseDeck,printingOptions,printingCaption,printingFallbackReason,validateDraftRecovery,canDismissBackdrop} from './core.mjs';

const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='atlantis.functional.mydecks.v1', SESSION='atlantis.functional.search.v1';
let cards=[], decks=[], events=[], eventLoadState="loading", cardMap=new Map(), meta={}, loadFailed=false, hideImages=false, selectedCards=[], cardPage=1, toastTimer, pendingDelete=null, local={version:2,decks:[],trash:[]}, storageOk=true, currentView='home', composing=false;
const pageSize=24;
const PRINT_MODE='atlantis.printing.mode.v1',DRAFT_SESSION='atlantis.editor.draft.v1';
const DEFAULT_PRINTING_MODE='en';
let printingMode=DEFAULT_PRINTING_MODE,printings=null,pendingDraft=null,draftRevision=null,draftStorageBaseline=null;
try{const saved=localStorage.getItem(PRINT_MODE);if(['en','ja'].includes(saved))printingMode=saved;}catch{}
let draftActive=false,draftBase=null,draftEpoch=0;
const POOL_SESSION='atlantis.functional.pool.v1';
let cardPool=[],poolTarget='',poolUndo=[],poolOpener=null,pendingPool=null,savingPool=false,storageBaseline=null;
function message(text,action){clearTimeout(toastTimer);$('#toast').hidden=false;$('#toast').innerHTML=esc(text)+(action?'<button id="toast-action">Undo</button>':'');if(action)$('#toast-action').onclick=action;toastTimer=setTimeout(()=>$('#toast').hidden=true,8000);}
function readLocal(){try{const raw=localStorage.getItem(STORAGE);local=raw?validateLocalState(JSON.parse(raw)):{version:2,decks:[],trash:[]};storageBaseline=raw;storageOk=true;}catch(e){storageOk=false;$('#my-status').textContent='保存データを読み取れません。このブラウザのデータを上書きせず、保存を停止しています。';$('#my-status').className='error';}}
function persist(next){if(!storageOk)throw new Error('このブラウザの保存領域を利用できません。');if(localStorage.getItem(STORAGE)!==storageBaseline)throw new Error('別のタブでマイデッキが更新されました。保存先を再読込して内容を確認してください。');const valid=validateLocalState(next),raw=JSON.stringify(valid);localStorage.setItem(STORAGE,raw);storageBaseline=raw;local=valid;}
function field(id){return $('#'+id).value;}
function selectedColors(prefix){return $$(`#${prefix}-colors input:checked`).map(x=>x.value);}
function cardFilters(){return {name:field('card-name'),oracle:field('card-oracle'),keyword:field('card-keyword'),colors:selectedColors('card'),colorMode:field('card-color-mode'),type:field('card-type'),min:field('card-min'),max:field('card-max')};}
function deckFilters(){return {query:field('deck-query'),cards:[...selectedCards],side:$('#deck-side').checked,colors:selectedColors('deck'),colorMode:field('deck-color-mode'),archetype:field('deck-archetype')};}
function date(v){return new Date(v).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function cardName(c){return c?.ja||c?.name||'不明なカード';}
function poolCountCaption(id){return `プール：メイン ${cardPool.find(x=>x.id===id&&x.zone==='main')?.qty||0} ／ サイド ${cardPool.find(x=>x.id===id&&x.zone==='side')?.qty||0}`;}
function cardCaption(c){return c.ja?`${c.ja} / ${c.name}`:c.name+'（日本語名未収録）';}
function tags(colors){return (colors.length?colors:['C']).map(c=>`<span class="tag">${colorNames[c]}</span>`).join('');}
function imageMarkup(c,art=false){
 const selection=printingOptions(printings?.cards[c?.id],printingMode),chosen=selection.choices[0],url=art?(chosen?.art||chosen?.image):chosen?.image,cls=art?'art':'card-image',caption=printingCaption(chosen);
 return !url||hideImages?`<div class="${cls} image-failed">${esc(cardName(c))}<br>画像なし・テキストで確認</div>`:`<figure class="printing-image" data-selected-print="${esc(chosen.id)}"><img class="${cls}" src="${esc(url)}" alt="${esc(cardName(c))} — ${esc(caption)}" data-image-card="${esc(c.id)}" data-image-art="${art?'1':'0'}" data-image-index="0" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption><span class="printing-caption">${esc(caption)}</span><span class="printing-fallback" ${selection.reason?'':'hidden'}>${esc(selection.reason)}</span></figcaption></figure>`;
}
document.addEventListener('error',e=>{
 const img=e.target;if(img.tagName!=='IMG'||!img.dataset.imageCard)return;
 const c=cardMap.get(img.dataset.imageCard),record=printings?.cards[c?.id],selection=printingOptions(record,printingMode),index=Number(img.dataset.imageIndex||0)+1,next=selection.choices[index],figure=img.closest('.printing-image');
 if(!figure)return;
 if(next){
  const caption=printingCaption(next),reason=printingFallbackReason(record,printingMode,next,{imageFailed:true});
  img.dataset.imageIndex=index;figure.dataset.selectedPrint=next.id;
  img.alt=cardName(c)+' — '+caption+' — '+reason;
  figure.querySelector('.printing-caption').textContent=caption;
  const status=figure.querySelector('.printing-fallback');status.textContent=reason;status.hidden=false;
  const card=figure.closest('.card');if(card){const meta=card.querySelector('.list-printing-meta');if(meta)meta.textContent=caption;const tileMeta=card.querySelector('.card-tile-meta');if(tileMeta)tileMeta.textContent=c.type+' · '+next.set.toUpperCase();const note=card.querySelector('.card-fallback');if(note){note.textContent=reason;note.hidden=false;}}
  const link=figure.closest('.detail-top')?.querySelector('[data-printing-link]');if(link)link.href=next.url;
  img.src=img.dataset.imageArt==='1'?(next.art||next.image):next.image;return;
 }
 const status=figure.querySelector('.printing-fallback');status.hidden=false;status.textContent='全候補の画像を取得できません';
 const note=figure.closest('.card')?.querySelector('.card-fallback');if(note){note.textContent=status.textContent;note.hidden=false;}
 const box=document.createElement('div');box.className=(img.className||'')+' image-failed';box.textContent=cardName(c)+' — 画像を取得できません';img.replaceWith(box);
},true);
function colorControls(prefix){const labels={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless',A:'Artifacts'};$('#'+prefix+'-colors').innerHTML=`<fieldset><legend>Colors</legend><div class="color-buttons">${Object.entries(colorNames).filter(([c])=>prefix==='card'||c!=='A').map(([c,name])=>`<label class="color-${c}"><input type="checkbox" value="${c}" aria-label="${labels[c]||name}"><span>${labels[c]||name}</span></label>`).join('')}</div></fieldset>`;}
function saveSearch(){try{const values={};$$('input[id],select[id]').filter(x=>!x.id.startsWith('edit-')&&!x.id.startsWith('pool-')&&!x.id.startsWith('builder-')&&!['printing-mode','restore-file','hide-images','deck-card','my-query','my-sort','builder-target','builder-qty','builder-new-name-input'].includes(x.id)&&x.type!=='file'&&x.type!=='hidden').forEach(x=>values[x.id]=x.type==='checkbox'?x.checked:x.value);sessionStorage.setItem(SESSION,JSON.stringify({sortDefaultsVersion:2,values,selectedCards,cardPage,currentView,colors:{card:selectedColors('card'),deck:selectedColors('deck')},display:field('card-display')}));}catch{}}
function restoreSearch(){try{const saved=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(!saved)return;for(const[id,value]of Object.entries(saved.values||{})){const input=$('#'+id);if(input&&id!=='printing-mode'&&(!['deck-sort','card-sort'].includes(id)||saved.sortDefaultsVersion===2)){if(input.type==='checkbox')input.checked=!!value;else input.value=String(value);}}for(const prefix of ['card','deck'])$$(`#${prefix}-colors input`).forEach(x=>x.checked=(saved.colors?.[prefix]||[]).includes(x.value));selectedCards=(saved.selectedCards||[]).filter(id=>cardMap.has(id));cardPage=Math.max(1,Number(saved.cardPage)||1);currentView=['home','decks','cards','events','my','guide','about'].includes(saved.currentView)?saved.currentView:'home';$('#card-display').value=saved.display==='list'?'list':'grid';}catch{}}
function navigate(view){
 const route={pool:'cards',mydecks:'my',cards:'cards',my:'my'};
 const next=route[view]||view;
 if(!['home','decks','cards','events','my','guide','about'].includes(next))return;
 currentView=next;
 $$('.view').forEach(v=>v.hidden=v.id!=='view-'+next);
 const hash={cards:'pool',my:'mydecks'}[next]||next;
 $$('nav a[href^="#"]').forEach(a=>{const active=a.getAttribute('href')==='#'+hash;if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(location.hash!=='#'+hash)history.replaceState({},'', '#'+hash);
 saveSearch();if(next==='my')renderMy();if(next==='events')renderEvents();
}
function chip(text,action){return `<button class="chip" type="button" ${action}>${esc(text)} ×</button>`;}
function addActiveFilters(container,filters,kind){let out=[];const labels=kind==='card'?{name:'カード名',oracle:'能力',keyword:'キーワード',type:'タイプ',min:'マナ下限',max:'マナ上限'}:{query:'検索語',archetype:'分類'};for(const[k,label]of Object.entries(labels))if(filters[k]!==''&&filters[k]!=null)out.push(chip(label+'：'+(types[filters[k]]||filters[k]),`data-remove-field="${kind==='card'?'card':'deck'}-${k==='query'?'query':k}"`));for(const color of filters.colors)out.push(chip(colorNames[color],`data-remove-color="${kind}:${color}"`));$(container).innerHTML=out.join('');}
function renderSelected(){ $('#selected-cards').innerHTML=selectedCards.map(id=>chip(cardName(cardMap.get(id)),`data-remove-card="${id}"`)).join(''); }
function addDeckCard(){const q=normalize(field('deck-card'));if(!q)return;let c=cards.find(c=>normalize(c.name)===q||normalize(c.ja)===q);if(!c){const matches=cards.filter(c=>c.nameIndex.includes(q));if(matches.length===1)c=matches[0];else{message(matches.length?'候補からカード名を選んでください。':'取得データ内にカードが見つかりません。');return;}}if(!selectedCards.includes(c.id))selectedCards.push(c.id);$('#deck-card').value='';renderDecks();saveSearch();}
function empty(text,kind){return `<div class="empty"><h2>${esc(text)}</h2><p>検索語を短くするか、選択した条件を解除してください。</p><button type="button" data-reset="${kind}">Reset</button></div>`;}
function deckTile(d,{localDeck=false}={}){
 const parsed=localDeck?parsedLocalDeck(d):null, hero=cardMap.get(localDeck?parsed.rows[0]?.id:d.hero);
 const colors=localDeck?[...new Set(parsed.rows.flatMap(row=>cardMap.get(row.id)?.colors||[]))]:d.colors;
 const action=localDeck?'data-local-view':'data-deck';
 return `<article class="deck-card featured-card"><button type="button" class="featured-open" ${action}="${esc(d.id)}" aria-label="${esc(d.name)} details">${imageMarkup(hero,true)}<div class="content"><span class="eyebrow">${esc(localDeck?'MY DECK':d.archetype)}</span><h3>${esc(d.name)}</h3><div class="deck-card-meta"><span>${esc(localDeck?'ブラウザ内のみ':d.author+(d.sample?' · SAMPLE':''))}${!localDeck&&d.result?`<br>${esc(d.event)} · ${esc(d.result)}`:''}</span><span>${(colors.length?colors:['C']).map(x=>colorNames[x]).join(' / ')}</span></div></div></button>${localDeck?`<div class="small-actions"><button data-local-view="${esc(d.id)}">Open</button><button data-edit="${esc(d.id)}">Edit Deck</button><button data-local-export="${esc(d.id)}">Export JSON</button><button data-delete="${esc(d.id)}">Delete</button></div>`:''}</article>`;
}
function renderDecks(){
 if(loadFailed){$('#deck-result-count').textContent='読込失敗';$('#deck-results').innerHTML='<p class="empty">データを読み込めません。再読込をお試しください。</p>';return;}
 const f=deckFilters(),results=decks.filter(d=>deckMatches(d,f,cardMap)),sort=field('deck-sort');
 results.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ja'):sort==='updated'?b.updated.localeCompare(a.updated):a.order-b.order);
 $('#deck-result-count').textContent=`${results.length} / ${decks.length} 件`;renderSelected();addActiveFilters('#deck-active',f,'deck');
 $('#deck-results').innerHTML=results.map(d=>deckTile(d)).join('')||empty('該当するデッキはありません','decks');
}
function setCardPages(html){for(const target of $$('.card-pagination'))target.innerHTML=html;}
function renderCards(){
 if(loadFailed){setCardPages('');$('#card-result-count').textContent='読込失敗';$('#card-results').innerHTML='<p class="empty">データを読み込めません。再読込をお試しください。</p>';return;}
 const f=cardFilters();addActiveFilters('#card-active',f,'card');
 if(f.min!==''&&f.max!==''&&Number(f.min)>Number(f.max)){$('#card-result-count').textContent='マナ総量の範囲を確認';$('#card-results').innerHTML='<p class="empty">下限を上限以下にしてください。</p>';setCardPages('');return;}
 const result=cards.filter(c=>cardMatches(c,f));result.sort((a,b)=>field('card-sort')==='mana'?a.mv-b.mv||cardName(a).localeCompare(cardName(b),'ja'):cardName(a).localeCompare(cardName(b),'ja'));
 const pages=Math.max(1,Math.ceil(result.length/pageSize));cardPage=Math.min(cardPage,pages);$('#card-result-count').textContent=`${result.length.toLocaleString()} / ${cards.length.toLocaleString()} 件`;
 const list=field('card-display')==='list';$('#card-results').className=list?'card-list':'card-grid';
 $('#card-results').innerHTML=result.slice((cardPage-1)*pageSize,cardPage*pageSize).map(c=>`<article class="card"><button type="button" class="card-image-button" data-card="${c.id}" aria-label="${esc(cardName(c))} — Card Details">${imageMarkup(c)}</button><div>${list?`<p class="list-printing-meta">${esc((()=>{const p=printingOptions(printings?.cards[c.id],printingMode).choices[0];return p?`${p.lang.toUpperCase()} ${p.set.toUpperCase()} #${p.number}`:'';})())}</p>`:''}<h3><button data-card="${c.id}">${esc(cardName(c))}</button></h3><p class="muted">${esc(c.name)}</p><p class="card-fallback" ${printingOptions(printings?.cards[c.id],printingMode).reason?'':'hidden'}>${esc(printingOptions(printings?.cards[c.id],printingMode).reason)}</p><p class="card-tile-meta">${esc(c.type)} · ${esc(printingOptions(printings?.cards[c.id],printingMode).choices[0]?.set?.toUpperCase()||'')}</p>${!c.ja?'<span class="badge">日本語名未収録</span>':''}${list?`<p>${esc(c.oracle.slice(0,160))}${c.oracle.length>160?'…':''}</p>`:''}</div></article>`).join('')||empty('該当するカードはありません','cards');
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
  const state={detail:type,id,detailMode:mode,detailScroll:0,detailKey:same?previous.detailKey:crypto.randomUUID(),detailDepth:same?previous.detailDepth:wasOpen?(previous?.detailDepth||1)+1:1};
  if(same)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
 }
 activeDetailKey=history.state?.detailKey;
 const position=restoringDetail?(detailPositions.get(activeDetailKey)??history.state?.detailScroll??0):0;
 dialog.dataset.kind=type;dialog.classList.toggle('has-back',(history.state?.detailDepth||1)>1);
 $('#detail-back').hidden=(history.state?.detailDepth||1)<=1;
 $('#detail-body').innerHTML=html;
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
function openCard(id){
 const c=cardMap.get(id);if(!c)return;
 const related=decks.filter(d=>[...d.main,...d.side].some(l=>l.id===id));
 const count=zone=>cardPool.find(x=>x.id===id&&x.zone===zone)?.qty||0;
 showDetail(`<div class="detail-top"><div>${imageMarkup(c)}</div><div><h1>${esc(cardName(c))}</h1><p>${esc(c.name)}</p>${c.japaneseNameSource?`<p class="hint">日本語名：${c.japaneseNameMethod==='official correction'?'公式資料に基づき補正':c.japaneseNameMethod==='catalog override'?'API欠落を資料から補完':'Scryfall収録名'} · <a href="${esc(c.japaneseNameSource)}" target="_blank" rel="noopener noreferrer">出典</a></p>`:''}<p>${esc(c.type)}</p><p>サブタイプ：${esc(subtypes(c).flatMap(s=>[s,subtypeNames[s]||'']).filter(Boolean).join(' / ')||'なし')}</p><p>マナ・コスト ${esc(c.manaCost||'なし')} / マナ総量 ${c.mv}</p><h2>Oracle Text</h2><p class="oracle">${esc(c.oracle||'能力テキストなし')}</p><div class="detail-storage"><h2>Add to My Storage</h2><div class="actions"><button type="button" data-build-card="${c.id}" data-build-zone="main" data-detail-count="main">Add to Main (${count('main')})</button><button type="button" data-build-card="${c.id}" data-build-zone="side" data-detail-count="side">Add to Sideboard (${count('side')})</button><button type="button" id="detail-open-storage">My Storage (${count('main')+count('side')})</button></div></div><p class="muted">画像の版はSettingsのPrintingに従います。</p><a data-printing-link href="${esc(printingOptions(printings?.cards[c.id],printingMode).choices[0]?.url||c.url)}" target="_blank" rel="noopener noreferrer">Scryfallで確認</a></div></div><h2>このカードを使う掲載デッキ</h2>${related.length?related.map(d=>`<p><button class="link-button" data-deck="${d.id}">${esc(d.name)}</button> ${d.sample?'<span class="badge">サンプル</span>':''}</p>`).join(''):'<p>掲載デッキには採用例がありません。</p>'}`,'card',id);
}
function deckText(d){return d.englishText;}
function listTable(lines){return `<table class="deck-table"><tbody>${lines.map(l=>{const c=cardMap.get(l.id);return `<tr><td>${l.qty}</td><td><button class="link-button" data-card="${c.id}">${esc(cardName(c))}</button><br><span class="muted">${esc(c.name)}</span></td></tr>`;}).join('')}</tbody></table>`;}
function openDeck(id){const d=decks.find(d=>d.id===id);if(!d)return;showDetail(`<div class="detail-top"><div>${imageMarkup(cardMap.get(d.hero))}</div><div>${d.sample?'<span class="badge">検証用サンプル・実績なし</span>':''}<h1>${esc(d.name)}</h1><p>${esc(d.author)}</p>${d.result?`<p><strong>${esc(d.event)} · ${esc(d.result)}</strong><br>${esc(d.venue)}</p><p class="hint">出典：${esc(d.source)} · ${esc(d.sourceDeckId)}<br>記録日：${esc(d.recordedAt.slice(0,10))}</p>`:''}<div class="tags">${tags(d.colors)}<span class="tag">${esc(d.archetype)}</span></div>${d.sample?'<p class="hint">表示・検索・持ち出しの検証用構成です。大会提出リストや推奨構築ではありません。</p>':''}<div class="actions"><button data-copy="${d.id}">Copy List</button><button data-download="${d.id}">Download List</button></div><p class="hint">実MTGOへの取込は未検証です。</p></div></div><div class="two-col"><div><h2>メイン ${d.main.reduce((s,x)=>s+x.qty,0)}枚</h2>${listTable(d.main)}</div><div><h2>サイド ${d.side.reduce((s,x)=>s+x.qty,0)}枚</h2>${listTable(d.side)}</div></div>${d.sidePlan?`<h2>サイドプラン</h2><p>${esc(d.sidePlan)}</p>`:''}`,'deck',id);}
const parsedDeckCache=new WeakMap();
function parsedLocalDeck(d){const hit=parsedDeckCache.get(d);if(hit?.map===cardMap&&hit.text===d.text)return hit.value;const value=parseDeck(d.text,cardMap);parsedDeckCache.set(d,{map:cardMap,text:d.text,value});return value;}
function renderMy(){renderBuilder(); $('#my-count').textContent=local.decks.length;const q=normalize(field('my-query'));const rows=local.decks.filter(d=>normalize(d.name).includes(q)).sort((a,b)=>field('my-sort')==='name'?a.name.localeCompare(b.name,'ja'):b.updated.localeCompare(a.updated));if(storageOk){$('#my-status').textContent=`${rows.length} / ${local.decks.length} 件 · このブラウザだけに保存`;}$('#my-results').innerHTML=rows.map(d=>deckTile(d,{localDeck:true})).join('')||(local.decks.length?empty('条件に合うマイデッキはありません','my'):'<div class="empty"><h2>マイデッキはまだありません</h2><p>保存したデータはこのブラウザだけに残ります。</p><button class="primary" id="empty-new">+ New Deck</button></div>');}
function openMyDeck(id,mode='visual'){
 const d=local.decks.find(x=>x.id===id);if(!d)return;const parsed=parsedLocalDeck(d);
 const zones=['main','side'].map(zone=>{const rows=parsed.rows.filter(x=>x.zone===zone);return `<h2>${zone==='main'?'メイン':'サイド'} ${rows.reduce((n,x)=>n+x.qty,0)}枚（認識分）</h2><div class="visual-grid">${rows.map(x=>{const c=cardMap.get(x.id);return `<article>${imageMarkup(c)}<strong>${x.qty}枚</strong><button class="link-button" data-card="${esc(c.id)}">${esc(cardName(c))}</button><p class="muted">${esc(c.name)}</p></article>`;}).join('')||'<p>認識したカードはありません。</p>'}</div>`;}).join('');
 showDetail(`<h1>${esc(d.name)}</h1><div class="actions"><button data-local-view="${esc(id)}" aria-pressed="${mode==='visual'}">Visual</button><button data-local-text="${esc(id)}" aria-pressed="${mode==='text'}">Text</button><button data-edit="${esc(id)}">Edit Deck</button></div>${mode==='text'?`<pre class="raw-deck">${esc(d.text)}</pre>`:zones+`<h2>読み取れなかった行 ${parsed.unknown.length}件</h2><p class="hint">枚数は認識できた行のみ。保存済み本文は変更しません。</p>${parsed.sideHeadings>1?'<p class="error">サイド見出しが複数あります。区分を確認してください。</p>':''}<ol class="unknown-lines">${parsed.unknown.map(x=>`<li value="${x.line}"><code>${esc(x.text)}</code></li>`).join('')}</ol>`}`,'local',id,mode);
}
function refreshDetail(){const state=history.state;if(!$('#detail').open||!state?.detail)return;captureDetailPosition();renderDetailState(history.state);}
function draftSnapshot(){return Object.fromEntries(['id','name','text','note'].map(k=>[k,field('edit-'+k)]));}
function draftDirty(){return draftActive&&JSON.stringify(draftSnapshot())!==JSON.stringify(draftBase);}
function renderBuilder(){
 const chosen=poolTarget;
 $('#builder-target').innerHTML='<option value="">New Deck</option>'+local.decks.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
 if(local.decks.some(d=>d.id===chosen))$('#builder-target').value=chosen;
 else if(chosen){$('#builder-target').insertAdjacentHTML('beforeend',`<option value="${esc(chosen)}">保存先が見つかりません — 選び直してください</option>`);$('#builder-target').value=chosen;}
 $('#builder-new-name').hidden=!!field('builder-target');$('#builder-active').hidden=!draftActive;$('#my-draft-note').hidden=!draftActive;
 $('#builder-active').textContent=draftActive?`本文も編集中：${field('edit-name')||'新しいマイデッキ'}。同じ保存先を選ぶと、この未保存本文に追加します。`:'';
 const ids=[...new Set(cardPool.map(x=>x.id))],main=cardPool.filter(x=>x.zone==='main').reduce((s,x)=>s+x.qty,0),side=cardPool.filter(x=>x.zone==='side').reduce((s,x)=>s+x.qty,0);
 const count=(id,zone)=>cardPool.find(x=>x.id===id&&x.zone===zone)?.qty||0;
 function qtyCell(id,zone){const qty=count(id,zone),label=zone==='main'?'Main':'Sideboard';return `<div class="qty-stepper"><button type="button" id="pool-${id}-${zone}-minus" data-pool-adjust="${id}" data-zone="${zone}" data-delta="-1" aria-label="${esc(cardName(cardMap.get(id)))}の${label}を1枚減らす" ${qty?'':'disabled'}>−</button><input type="number" id="pool-${id}-${zone}-qty" data-pool-qty="${id}" data-zone="${zone}" min="0" max="1000" step="1" value="${qty}" aria-label="${esc(cardName(cardMap.get(id)))}の${label}枚数"><button type="button" id="pool-${id}-${zone}-plus" data-pool-adjust="${id}" data-zone="${zone}" data-delta="1" aria-label="${esc(cardName(cardMap.get(id)))}の${label}を1枚増やす">＋</button></div>`;}
 $('#builder-pool').innerHTML=ids.map(id=>{const c=cardMap.get(id),print=printingOptions(printings?.cards[id],printingMode).choices[0],art=print?.art||print?.image||'';return `<div class="pool-row"><div class="pool-desktop-card pool-card">${imageMarkup(c)}<div><button type="button" class="link-button" data-pool-inspect="${id}">${esc(cardName(c))}</button><small>${esc(c?.name||'')}</small></div></div><div class="pool-zone"><span class="mobile-label">Main</span>${qtyCell(id,'main')}</div><div class="pool-zone"><span class="mobile-label">Sideboard</span>${qtyCell(id,'side')}</div><button type="button" class="pool-desktop-remove" data-pool-remove="${id}" aria-label="Remove ${esc(c?.name||cardName(c))}">Remove</button><div class="pool-mobile-row"><button type="button" class="pool-mobile-name" data-pool-inspect="${id}" title="${esc(cardName(c))}">${esc(cardName(c))}</button><button type="button" class="pool-mobile-art" data-pool-inspect="${id}" aria-label="${esc(cardName(c))} details">${art?`<img src="${esc(art)}" alt="" referrerpolicy="no-referrer">`:'◈'}</button><button type="button" class="pool-mobile-add" data-pool-adjust="${id}" data-zone="main" data-delta="1" aria-label="Add ${esc(c?.name||cardName(c))} to Main">Main +<small>${count(id,'main')}</small></button><button type="button" class="pool-mobile-add" data-pool-adjust="${id}" data-zone="side" data-delta="1" aria-label="Add ${esc(c?.name||cardName(c))} to Sideboard">Side +<small>${count(id,'side')}</small></button><button type="button" class="pool-mobile-remove" data-pool-remove="${id}" aria-label="Remove ${esc(c?.name||cardName(c))}">🗑</button></div></div>`;}).join('')||'<div class="pool-empty"><strong>My Storageは空です</strong><p>Cardsのカード画像を開き、詳細から追加してください。</p></div>';
 $('#builder-save').disabled=!cardPool.length||savingPool;$('#builder-clear').disabled=!cardPool.length;$('#pool-undo').disabled=!poolUndo.length;
 $('#builder-main-total').textContent=main;$('#builder-side-total').textContent=side;$('#builder-count').textContent=`${main+side}枚 · ${ids.length}種類 · 未保存`;
 $('#pool-toggle').textContent=`My Storage (${main+side}) · Main ${main} / Sideboard ${side}`;
 $('#pool-toggle').setAttribute('aria-expanded',String($('#builder').open));
 const detail=history.state?.detail==='card'&&$('#detail').open?history.state.id:null;
 if(detail){for(const zone of ['main','side']){const b=$(`[data-detail-count="${zone}"]`);if(b)b.textContent=`Add to ${zone==='main'?'Main':'Sideboard'} (${count(detail,zone)})`;}const b=$('#detail-open-storage');if(b)b.textContent=`My Storage (${main+side})`;}
 updatePoolPreview();
}
function openPool(){poolOpener=document.activeElement;renderBuilder();if(!$('#builder').open)$('#builder').showModal();$('#pool-toggle').setAttribute('aria-expanded','true');$('#pool-close').focus();}
function closePool(){if($('#builder').open)$('#builder').close();$('#pool-toggle').setAttribute('aria-expanded','false');if(poolOpener?.isConnected)poolOpener.focus({preventScroll:true});}
function savePoolSession(){try{if(cardPool.length)sessionStorage.setItem(POOL_SESSION,JSON.stringify({version:1,pool:cardPool,target:poolTarget,name:field('builder-new-name-input'),note:field('builder-note')}));else if(!pendingPool)sessionStorage.removeItem(POOL_SESSION);}catch{$('#builder-status').textContent='再読込用の一時退避ができません。ページを閉じる前にマイデッキへ保存してください。';}}
function updatePool(next,label){const focusId=document.activeElement?.id;if(JSON.stringify(next)===JSON.stringify(cardPool))return;poolUndo.push(structuredClone(cardPool));if(poolUndo.length>30)poolUndo.shift();cardPool=next;renderBuilder();savePoolSession();$('#builder-status').textContent=label;const focus=focusId&&document.getElementById(focusId);if(focus&&!focus.disabled)focus.focus({preventScroll:true});}
function poolBase(){
  if(poolTarget&&!local.decks.some(d=>d.id===poolTarget))throw new Error('保存先のデッキが見つかりません。選び直してください。');
  if(draftActive&&field('edit-id')!==poolTarget)throw new Error('別のデッキの本文を編集中です。本文編集を保存または終了してから、この保存先へ追加してください。');
  if(pendingDraft)throw new Error('復元待ちのテキストがあります。先に復元または破棄してください。');
  if(draftActive)return {id:field('edit-id'),name:poolTarget?field('edit-name'):(field('builder-new-name-input')||field('edit-name')),text:field('edit-text'),note:poolTarget?field('edit-note'):(field('builder-note')||field('edit-note'))};
  return local.decks.find(d=>d.id===poolTarget)||{id:'',name:field('builder-new-name-input'),text:'',note:field('builder-note')};
}
function updatePoolPreview(){try{const base=poolBase();if((base.text.match(/^Sideboard\s*$/gim)||[]).length>1)throw new Error('Sideboard見出しが複数あります。本文編集で区分を一つにしてから保存してください。');$('#builder-preview').textContent=applyCardPool(base.text,cardPool,cardMap)||'保存するカードを一時プールに追加してください。';$('#builder-destination').textContent=poolTarget?`追加先：${base.name}`:`新規作成：${base.name||'デッキ名を入力してください'}`;$('#builder-preview-error').textContent='';}catch(error){$('#builder-preview').textContent='';$('#builder-preview-error').textContent=error.message;}}
function checkPoolRecovery(){if(cardPool.length||pendingPool!==null)return;try{const raw=sessionStorage.getItem(POOL_SESSION);if(!raw)return;pendingPool=validatePoolRecovery(JSON.parse(raw),cardMap);if(!pendingPool.pool.length){pendingPool=null;return;}$('#pool-recovery').hidden=false;}catch{$('#pool-recovery').hidden=false;$('#pool-recovery-text').textContent='未保存データを読み取れませんでした。保存済みマイデッキには影響しません。';$('#pool-recover').disabled=true;}}
function startDraft(id){
  if(pendingDraft)throw new Error('先に未保存テキストの復元または破棄を選んでください。');
  if(draftActive)return;
  const d=local.decks.find(x=>x.id===id);
  for(const k of ['id','name','text','note'])$('#edit-'+k).value=d?.[k]||'';
  draftActive=true;draftEpoch++;draftBase=draftSnapshot();draftRevision=d?.updated||null;draftStorageBaseline=storageBaseline;$('#save-error').textContent='';$('#paste-status').textContent='';$('#builder-status').textContent='';
  const input=$('#edit-text');input.setSelectionRange(input.value.length,input.value.length);renderBuilder();
}
function editor(id){
  if(draftActive&&id&&id!==field('edit-id'))message('編集中のデッキがあります。保存するか「編集を終了」してから切り替えてください。');
  try{startDraft(id);}catch(error){message(error.message);return;}$('#editor-title').textContent='Deck Editor';
  if(!$('#editor').open)$('#editor').showModal();$('#edit-name').focus();
}
function addToPool(id,zone){
  try{
    if(!$('#pool-recovery').hidden)throw new Error('復元待ちの一時プールがあります。先に「復元」または「破棄」を選んでください。');
    const c=cardMap.get(id);
    const next=stageSearchCard(cardPool,c,zone);
    const text=`${cardName(c)}を${zone==='main'?'メイン':'サイド'}に1枚追加しました。保存前の本文は変わりません。`;
    updatePool(next,text);message(text);
  }catch(error){$('#builder-status').textContent=error.message;message(error.message);}
}
function savePool(){
  if(!cardPool.length||savingPool)return;
  savingPool=true;$('#builder-save').disabled=true;
  try{
    if(draftActive)assertDraftRevision();
    const existing=local.decks.find(d=>d.id===poolTarget),base=poolBase();
    if((base.text.match(/^Sideboard\s*$/gim)||[]).length>1)throw new Error('Sideboard見出しが複数あります。本文編集で区分を確認してください。');
    const name=base.name.trim();if(!name)throw new Error('新しいマイデッキの名前を入力してください。');
    const updated={...base,id:base.id||crypto.randomUUID(),name,text:applyCardPool(base.text,cardPool,cardMap),updated:new Date().toISOString()};
    persist({...local,decks:existing?local.decks.map(d=>d.id===existing.id?updated:d):[updated,...local.decks]});
    cardPool=[];poolUndo=[];poolTarget='';$('#builder-new-name-input').value='';$('#builder-note').value='';$('#editor').close();draftActive=false;draftBase=null;draftEpoch++;clearDraftRecovery();
    savePoolSession();closePool();navigate('my');renderMy();message(`「${name}」をマイデッキに保存しました。`);
    $('#saved-deck-action').hidden=false;$('#saved-deck-open').dataset.edit=updated.id;$('#saved-deck-name').textContent=name;
  }catch(error){$('#builder-status').textContent=error.message;message(error.message);}
  finally{savingPool=false;$('#builder-save').disabled=!cardPool.length;}
}
function backup(decks=local.decks){return createBackup(decks);}
function download(text,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBackup(rows=local.decks){download(JSON.stringify(backup(rows),null,2),'atlantis-mydecks-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8');message('バックアップを書き出しました。');}
function reset(kind){if(kind==='cards'){for(const id of ['card-name','card-oracle','card-keyword','card-type','card-min','card-max'])$('#'+id).value='';$$('#card-colors input').forEach(x=>x.checked=false);$('#card-color-mode').value='includes';cardPage=1;renderCards();}else if(kind==='decks'){for(const id of ['deck-query','deck-archetype','deck-card'])$('#'+id).value='';selectedCards=[];$('#deck-side').checked=false;$('#deck-color-mode').value='includes';$$('#deck-colors input').forEach(x=>x.checked=false);renderDecks();}else{$('#my-query').value='';renderMy();}saveSearch();}
function allResults(){renderDecks();renderCards();renderMy();}
function searchFor(kind){if(composing)return;if(kind==='cards'){cardPage=1;renderCards();}else renderDecks();saveSearch();}
async function load(){loadFailed=false;$('#load-status').className='';$('#load-status').textContent='データを読み込んでいます…';try{const responses=await Promise.all([fetch('data/cards.json',{cache:'no-store'}),fetch('data/decks.json',{cache:'no-store'})]);if(responses.some(r=>!r.ok))throw new Error('HTTP error');const [c,d]=await Promise.all(responses.map(r=>r.json()));meta=c.meta;cards=c.cards.map(prepare);cardMap=new Map(cards.map(c=>[c.id,c]));decks=d;$('#deck-sample-notice').hidden=!decks.some(d=>d.sample);$('#card-suggestions').innerHTML=cards.map(c=>`<option value="${esc(c.ja||c.name)}" label="${esc(c.name)}"></option>${c.ja?`<option value="${esc(c.name)}" label="${esc(c.ja)}"></option>`:''}`).join('');$('#deck-suggestions').innerHTML=decks.map(d=>`<option value="${esc(d.name)}"></option>`).join('');$('#deck-archetype').innerHTML='<option value="">All</option>'+[...new Set(decks.map(d=>d.archetype))].map(t=>`<option>${esc(t)}</option>`).join('');$('#source-info').textContent=`Scryfall基準クエリ「${meta.query}」の取得結果：${cards.length.toLocaleString()}件、日本語名 ${meta.japaneseNames.toLocaleString()}件。初回取得 ${date(meta.fetchedAt)}、全件再照合 ${date(meta.lastAuditAt||meta.fetchedAt)}。全ページ取得・前回集合との一致を確認。日本語名はAPI ${meta.japaneseNamesFromScryfall??meta.japaneseNames}件と出典付き補完 ${meta.japaneseNameOverrides||0}件、公式資料に基づく補正 ${meta.japaneseNameCorrections||0}件。日本語印刷文の収録は ${meta.japanesePrintedText??0}件で、日本語全文検索には使いません。`;restoreSearch();$('#load-status').textContent='';allResults();checkPoolRecovery();checkDraftRecovery();navigate(location.hash.slice(1)||'home');renderFeatured();}catch(e){loadFailed=true;$('#load-status').className='status-error';$('#load-status').innerHTML='カード・デッキデータの読込に失敗しました。検索条件は保持しています。<button id="load-retry">再試行</button>';allResults();}}

colorControls('card');colorControls('deck');$('#card-type').innerHTML+=[...Object.entries(types)].map(([en])=>`<option value="${en}">${en}</option>`).join('');$('#language-help').innerHTML='<strong>能力語</strong><p>'+esc(Object.keys(oracleWords).join(' / '))+'</p><strong>サブタイプ</strong><p>'+esc(Object.values(subtypeNames).join(' / '))+'</p>';
for(const aside of $$('.filters')){const prefix=aside.querySelector('#card-colors')?'card':'deck';const colors=$('#'+prefix+'-colors');const mode=$('#'+prefix+'-color-mode').closest('label');const basic=document.createElement('div');basic.className='basic-filters';basic.append(colors,mode);const content=document.createElement('div');content.className='filter-body';while(aside.firstChild)content.append(aside.firstChild);aside.append(basic,content);aside.classList.add('collapseable');const b=document.createElement('button');b.type='button';b.className='filter-toggle';b.textContent='Filters';b.setAttribute('aria-expanded','false');b.onclick=()=>{const open=aside.classList.toggle('open');b.setAttribute('aria-expanded',String(open));};aside.insertBefore(b,content);}
document.addEventListener('compositionstart',()=>composing=true);document.addEventListener('compositionend',()=>composing=false);
$('#deck-form').onsubmit=e=>{e.preventDefault();searchFor('decks');};$('#card-form').onsubmit=e=>{e.preventDefault();searchFor('cards');};$('#add-card').onclick=addDeckCard;$('#deck-card').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&!composing){e.preventDefault();addDeckCard();}};
// Cards has a permanent search sidebar on desktop and stacked rows on mobile.
for(const kind of ['decks','cards']){
 const view=$('#view-'+kind),prefix=kind==='decks'?'deck':'card',form=$('#'+prefix+'-form'),filters=view.querySelector('.filters'),toolbar=view.querySelector('.toolbar'),workspace=view.querySelector('.workspace');
 const controls=document.createElement('div');controls.className='search-controls';form.before(controls);
 const basic=filters.querySelector('.basic-filters'),body=filters.querySelector('.filter-body'),toggle=filters.querySelector('.filter-toggle');
 const colorRow=document.createElement('div');colorRow.className='search-color-row';colorRow.append(basic);
 body.id=prefix+'-filter-body';toggle.setAttribute('aria-controls',body.id);
 if(kind==='decks'){
  controls.append(form,colorRow,toolbar,filters);toolbar.insertBefore(toggle,toolbar.querySelector('label'));
 }else{
  const layout=document.createElement('div');layout.className='card-browser';controls.before(layout);layout.append(controls,workspace);
  controls.classList.add('card-search-sidebar');controls.setAttribute('role','search');controls.setAttribute('aria-label','カード検索と絞り込み');
  colorRow.append($('#card-sort').closest('label'),toolbar.querySelector('.display'));
  const help=document.createElement('details');help.className='search-help';const summary=document.createElement('summary');summary.textContent='検索方法';
  help.append(summary,form.querySelector('.hint'),body.querySelector('.hint'),view.querySelector('.language-help'));
  body.querySelector('h2').remove();toggle.remove();filters.classList.remove('collapseable');
  controls.append(form,colorRow,filters,help);filters.append(body);
  const topPages=document.createElement('div');topPages.id='card-pages-top';topPages.className='pagination card-pagination';topPages.setAttribute('aria-label','検索結果のページ送り（上部）');
  toolbar.insertBefore(topPages,$('#card-printing-open'));workspace.querySelector('.results-area').prepend(toolbar);
 }
}
for(const sel of ['#deck-colors input','#deck-color-mode','#deck-archetype','#deck-side','#deck-sort'])$$(sel).forEach(x=>x.addEventListener('change',()=>searchFor('decks')));
for(const sel of ['#card-colors input','#card-color-mode','#card-type','#card-min','#card-max','#card-sort'])$$(sel).forEach(x=>x.addEventListener('change',()=>searchFor('cards')));
$('#card-display').onchange=()=>{renderCards();saveSearch();};
$('#my-query').oninput=()=>{if(!composing)renderMy();};$('#my-query').addEventListener('compositionend',renderMy);$('#my-sort').onchange=renderMy;
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.buildCard)addToPool(b.dataset.buildCard,b.dataset.buildZone);if(b.id==='detail-open-storage'){closeDetail();openPool();}if(b.dataset.poolRemove)updatePool(cardPool.filter(item=>item.id!==b.dataset.poolRemove),'カードを除外しました。元に戻せます。');if(b.dataset.view)navigate(b.dataset.view);if(b.dataset.deck)openDeck(b.dataset.deck);if(b.dataset.card)openCard(b.dataset.card);if(b.dataset.event)openEvent(b.dataset.event);if(b.dataset.reset)reset(b.dataset.reset);if(b.dataset.removeCard){selectedCards=selectedCards.filter(id=>id!==b.dataset.removeCard);renderDecks();saveSearch();}if(b.dataset.removeColor){const[prefix,color]=b.dataset.removeColor.split(':');$(`#${prefix}-colors input[value="${color}"]`).checked=false;searchFor(prefix==='card'?'cards':'decks');}if(b.dataset.removeField){const x=$('#'+b.dataset.removeField);if(x){x.value='';searchFor(b.dataset.removeField.startsWith('card')?'cards':'decks');}}if(b.dataset.page){cardPage=Number(b.dataset.page);renderCards();saveSearch();$('#card-result-count').scrollIntoView({block:'start'});}if(b.dataset.close){if(b.dataset.close==='detail')closeDetail();else $('#'+b.dataset.close).close();}if(['new-deck','empty-new'].includes(b.id))editor();if(b.dataset.localView)openMyDeck(b.dataset.localView);if(b.dataset.localText)openMyDeck(b.dataset.localText,'text');if(b.dataset.edit){closeDetail();editor(b.dataset.edit);}if(b.dataset.delete){pendingDelete=b.dataset.delete;const d=local.decks.find(x=>x.id===pendingDelete);$('#confirm-text').textContent=`「${d.name}」をこのブラウザの一覧から削除します。`;$('#confirm-dialog').showModal();}if(b.dataset.localExport)exportBackup(local.decks.filter(x=>x.id===b.dataset.localExport));if(b.dataset.download){const d=decks.find(d=>d.id===b.dataset.download);download(deckText(d),d.id+'.txt');}if(b.dataset.copy){try{await navigator.clipboard.writeText(deckText(decks.find(d=>d.id===b.dataset.copy)));message('英語リストをコピーしました。');}catch{message('コピーが許可されませんでした。ダウンロードをご利用ください。');}}if(b.id==='load-retry')load();});
$('#editor-form').onsubmit=e=>{e.preventDefault();const name=field('edit-name').trim();if(!name){$('#save-error').textContent='デッキ名を入力してください。';return;}const d={id:field('edit-id')||crypto.randomUUID(),name,text:field('edit-text'),note:field('edit-note'),updated:new Date().toISOString()};try{assertDraftRevision();const exists=local.decks.some(x=>x.id===d.id);persist({...local,decks:exists?local.decks.map(x=>x.id===d.id?d:x):[d,...local.decks]});$('#editor').close();draftActive=false;draftBase=null;draftEpoch++;clearDraftRecovery();$('#builder-status').textContent='';navigate('my');renderMy();message('このブラウザに保存しました。');}catch(err){$('#save-error').textContent=err.message+' 入力は保持しています。';}};
$('#confirm-delete').onclick=()=>{try{const d=local.decks.find(x=>x.id===pendingDelete);if(!d)return;persist({...local,decks:local.decks.filter(x=>x.id!==d.id),trash:[...local.trash,d]});$('#confirm-dialog').close();renderMy();message('マイデッキを削除しました。',()=>{try{persist({...local,decks:[d,...local.decks],trash:local.trash.filter(x=>x.id!==d.id)});renderMy();message('元に戻しました。');}catch{message('復元できませんでした。保存設定を確認してください。');}});}catch{message('削除を保存できませんでした。データは変更していません。');}};
$('#backup').onclick=()=>exportBackup();$('#restore-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('10MB以内のバックアップを選んでください。');const data=JSON.parse(await file.text());const next=appendBackup(local,data);const added=next.decks.length-local.decks.length;persist(next);renderMy();message(`${added}件を追加して復元しました。既存データは保持しています。`);}catch(err){message('読み込めませんでした：'+err.message);}finally{e.target.value='';}};
$('#detail').addEventListener('cancel',e=>{e.preventDefault();closeDetail();});window.addEventListener('popstate',e=>{if(e.state?.detail)renderDetailState(e.state);else if($('#detail').open){$('#detail').close();if(detailOpener?.isConnected)detailOpener.focus({preventScroll:true});}});window.addEventListener('hashchange',()=>{if($('#menu-dialog').open)$('#menu-dialog').close();navigate(location.hash.slice(1));});
$('#test-error').onclick=()=>{saveSearch();loadFailed=true;$('#load-status').className='status-error';$('#load-status').innerHTML='検証用：通信失敗を表示しています。ローカル保存データは利用できます。<button id="load-retry">再試行</button>';renderCards();renderDecks();};$('#retry-load').onclick=load;$('#hide-images').onchange=e=>{hideImages=e.target.checked;allResults();refreshDetail();};

function entryLink(event){const url=externalEntryUrl(event.entryUrl);return url?`<a class="file-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(event.entryLabel||'外部の申込先を開く')} ↗</a>`:'<span class="badge">申込先未設定</span>';}
function eventFields(e){return `<dl class="event-facts"><dt>開催日時（日本時間）</dt><dd><time ${e.start?`datetime="${esc(e.start)}"`:''}>${esc(eventDate(e.start))}</time>〜<br><time ${e.end?`datetime="${esc(e.end)}"`:''}>${esc(eventDate(e.end))}</time></dd><dt>会場</dt><dd>${esc(e.venue||'未定')}</dd><dt>参加費</dt><dd>${esc(e.fee||'未定')}</dd><dt>大会形式</dt><dd>${esc(e.format||'未定')}</dd></dl>`;}
function renderEvents(){
  if(eventLoadState==='loading'){$('#event-count').textContent='大会案内を読み込んでいます…';$('#event-results').innerHTML='';return;}
  if(eventLoadState==='error'){$('#event-count').textContent='大会案内を読み込めませんでした。';$('#event-results').innerHTML='<div class="empty"><p>ほかの機能とマイデッキはそのまま利用できます。</p><button id="event-retry">大会案内を再読込</button></div>';return;}
  const listed=events.filter(e=>!e.sample);
  $('#event-count').textContent=listed.length?`${listed.length} 件`:'';
  $('#event-results').innerHTML=[...listed].sort((a,b)=>eventSortKey(a)-eventSortKey(b)).map(e=>`<article class="event-card"><h2><button class="link-button" data-event="${esc(e.id)}">${esc(e.title)}</button></h2>${eventFields(e)}<p>${esc(e.description)}</p><div class="actions"><button data-event="${esc(e.id)}">Details / Rules</button>${entryLink(e)}</div><p class="hint">${esc(e.entryNote)}</p></article>`).join('')||'<div class="empty"><h2>大会案内はまだありません</h2><p>日時、会場、参加方法などの正式な情報が決まり次第ご案内します。</p><a href="#decks">Decksを見る →</a></div>';
}
function openEvent(id){const event=events.find(e=>e.id===id);if(!event)return;showDetail(`${event.sample?'<span class="badge">架空のサンプル・実際の受付なし</span>':''}<h1>${esc(event.title)}</h1>${eventFields(event)}<h2>会場・住所</h2><p>${esc(event.address)}</p><h2>大会について</h2><p>${esc(event.description)}</p><h2>ルール・注意事項</h2><p class="event-rules">${esc(event.rules)}</p><h2>参加申込の案内</h2><p>参加申込は外部の案内先で行う想定です。ATLANTIS内での申込・キャンセル・定員管理はMVP対象外です。</p><div class="actions">${entryLink(event)}</div><p class="hint">${esc(event.entryNote)}</p>`,'event',id);}
async function loadEvents(){eventLoadState='loading';renderEvents();try{const r=await fetch('data/events.json',{cache:'no-store'});if(!r.ok)throw new Error('Event fetch error');const data=await r.json();if(!Array.isArray(data)||data.some(e=>!e.id||!e.title||!validOptionalDate(e.start)||!validOptionalDate(e.end)))throw new Error('Invalid events');events=data;$('#event-sample-notice').hidden=true;eventLoadState='ready';}catch{eventLoadState='error';}renderEvents();}
document.addEventListener('click',e=>{if(e.target.closest('#event-retry'))loadEvents();});
readLocal();renderMy();load();loadEvents();

$('#edit-name').addEventListener('input',renderBuilder);
$('#pool-toggle').onclick=openPool;$('#pool-close').onclick=closePool;
$('#builder').addEventListener('cancel',e=>{e.preventDefault();closePool();});
$('#builder-target').onchange=()=>{poolTarget=field('builder-target');updatePoolPreview();savePoolSession();renderBuilder();};
for(const id of ['builder-new-name-input','builder-note'])$('#'+id).oninput=()=>{updatePoolPreview();savePoolSession();};
$('#builder-save').onclick=savePool;
$('#builder-clear').onclick=()=>updatePool([],'一時プールを空にしました。「元に戻す」で復元できます。');
$('#pool-undo').onclick=()=>{if(!poolUndo.length)return;cardPool=poolUndo.pop();renderBuilder();savePoolSession();$('#builder-status').textContent='直前の操作を戻しました。';};
$('#builder-sync').onclick=()=>{if(draftDirty()){$('#builder-status').textContent='未保存の本文編集があります。先に本文編集を保存または終了してください。';return;}if(draftActive){draftActive=false;draftBase=null;draftEpoch++;clearDraftRecovery();}readLocal();renderMy();$('#builder-status').textContent='保存先を再読込しました。プレビューを確認してから保存してください。';};
$('#resume-draft').onclick=()=>editor();
$('#pool-recover').onclick=()=>{if(!pendingPool)return;cardPool=pendingPool.pool;poolTarget=pendingPool.target;$('#builder-new-name-input').value=pendingPool.name;$('#builder-note').value=pendingPool.note;pendingPool=null;$('#pool-recovery').hidden=true;renderBuilder();savePoolSession();navigate('cards');openPool();$('#builder-status').textContent='未保存の一時プールを復元しました。マイデッキへの保存はまだです。';};
$('#pool-forget').onclick=()=>{pendingPool=null;$('#pool-recovery').hidden=true;try{sessionStorage.removeItem(POOL_SESSION);}catch{}message('未保存の一時プールを破棄しました。');};
document.addEventListener('change',e=>{const input=e.target;if(!input.dataset.poolQty)return;try{updatePool(setPoolQuantity(cardPool,input.dataset.poolQty,input.dataset.zone,Number(input.value)),'枚数を変更しました。');}catch(error){renderBuilder();$('#builder-status').textContent=error.message;}});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.poolAdjust){const qty=cardPool.find(x=>x.id===b.dataset.poolAdjust&&x.zone===b.dataset.zone)?.qty||0;updatePool(setPoolQuantity(cardPool,b.dataset.poolAdjust,b.dataset.zone,qty+Number(b.dataset.delta)),'枚数を変更しました。');}if(b.dataset.poolMove)updatePool(movePoolCard(cardPool,b.dataset.poolMove,b.dataset.zone),'1枚を移動しました。合計枚数は変わりません。');if(b.dataset.poolInspect)openCard(b.dataset.poolInspect);}catch(error){$('#builder-status').textContent=error.message;}});
window.addEventListener('storage',e=>{if(e.key===STORAGE){$('#builder-status').textContent='別のタブで保存内容が変わりました。保存先を再読込してください。';}});
$('#search-build').onclick=()=>{poolTarget=field('edit-id');if(!poolTarget)$('#builder-new-name-input').value=field('edit-name');renderBuilder();$('#editor').close();navigate('cards');$('#pool-toggle').scrollIntoView({block:'start'});};
$('#discard-draft').onclick=()=>{
  if(draftDirty()&&!window.confirm('未保存の入力を破棄して編集を終了しますか？ 保存済みデータは変更しません。'))return;
  $('#editor').close();draftActive=false;draftBase=null;draftEpoch++;clearDraftRecovery();$('#builder-status').textContent='';renderBuilder();
};
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
window.addEventListener('beforeunload',event=>{if(draftDirty()||cardPool.length){event.preventDefault();event.returnValue='';}});

function assertDraftRevision(){if(draftActive&&(localStorage.getItem(STORAGE)!==draftStorageBaseline||(field('edit-id')&&(local.decks.find(d=>d.id===field('edit-id'))?.updated||null)!==draftRevision)))throw new Error('編集開始後に保存内容が変わりました。入力を確認し「新規として保存」を選ぶか、編集を終了して保存先を再読込してください。');}
function clearDraftRecovery(){try{sessionStorage.removeItem(DRAFT_SESSION);}catch{}}
function saveDraftRecovery(){if(!draftActive||pendingDraft)return;try{if(draftDirty())sessionStorage.setItem(DRAFT_SESSION,JSON.stringify({version:1,draft:draftSnapshot(),base:draftBase,revision:draftRevision,baseline:draftStorageBaseline}));else clearDraftRecovery();}catch{$('#draft-save-status').textContent='未保存テキストを退避できません。本文をコピーして保管してください。';}}
function checkDraftRecovery(){if(draftActive||pendingDraft)return;try{const raw=sessionStorage.getItem(DRAFT_SESSION);if(!raw)return;pendingDraft=validateDraftRecovery(JSON.parse(raw));$('#draft-recovery').hidden=false;}catch{$('#draft-recovery').hidden=false;$('#draft-recover').disabled=true;$('#draft-recovery-text').textContent='未保存テキストを読み取れません。保存済みデータは保持しています。';}}
$('#draft-recover').onclick=()=>{if(!pendingDraft)return;const r=pendingDraft;for(const k of ['id','name','text','note'])$('#edit-'+k).value=r.draft[k];draftBase=r.base;draftRevision=r.revision;draftStorageBaseline=r.baseline;draftActive=true;draftEpoch++;pendingDraft=null;$('#draft-recovery').hidden=true;editor();renderBuilder();saveDraftRecovery();$('#draft-save-status').textContent='未保存の入力を復元しました。マイデッキへの保存はまだです。';};
$('#draft-forget').onclick=()=>{pendingDraft=null;clearDraftRecovery();$('#draft-recovery').hidden=true;};
for(const k of ['name','text','note'])$('#edit-'+k).addEventListener('input',saveDraftRecovery);
$('#draft-as-new').onclick=()=>{if(!draftActive)return;try{readLocal();if(!storageOk)throw new Error('保存領域を読み取れません。');$('#edit-id').value='';draftRevision=null;draftStorageBaseline=storageBaseline;saveDraftRecovery();$('#editor-form').requestSubmit();}catch(error){$('#save-error').textContent=error.message;}};
for(const dialog of $$('dialog')){let outside=false,pointer=null;const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};const dismiss=()=>{if(dialog.id==='detail')closeDetail();else if(dialog.id==='builder')closePool();else dialog.close();};dialog.addEventListener('pointerdown',e=>{outside=e.button===0&&isOutside(e);pointer=e.pointerId;});dialog.addEventListener('pointerup',e=>{if(canDismissBackdrop(outside&&pointer===e.pointerId,isOutside(e)))dismiss();outside=false;});dialog.addEventListener('pointercancel',()=>outside=false);dialog.addEventListener('close',()=>{outside=false;saveDraftRecovery();});}
$('#printing-mode').value=printingMode;
$('#card-printing-open').textContent=`Printing: ${printingMode==='ja'?'Latest JP':'First EN'}`;
$('#printing-mode').onchange=()=>{printingMode=field('printing-mode')==='ja'?'ja':'en';try{localStorage.setItem(PRINT_MODE,printingMode);$('#printing-status').textContent='このブラウザの全画面に適用';}catch{$('#printing-status').textContent='保存領域を使えないため、このページ内だけに適用';}$('#card-printing-open').textContent=`Printing: ${printingMode==='ja'?'Latest JP':'First EN'}`;allResults();renderFeatured();refreshDetail();};
async function loadPrintings(){try{const response=await fetch('data/printings.json',{cache:'no-store'});if(!response.ok)throw new Error();const d=await response.json();if(!d.meta.complete)throw new Error();printings=d;$('#printing-status').textContent=`表示版データ ${d.meta.snapshotDate} · 規則 v${d.meta.ruleVersion}`;}catch{$('#printing-status').textContent='表示版データの読込失敗。画像を表示できません。';}allResults();renderFeatured();refreshDetail();}
loadPrintings();

function renderFeatured(){
 $('#featured-decks').innerHTML=decks.filter(d=>!d.sample&&d.result).slice().sort((a,b)=>a.order-b.order).slice(0,3).map(d=>deckTile(d)).join('');
}
$('#settings-open').onclick=()=>{$('#settings-dialog').showModal();$(`input[name="printing-choice"][value="${printingMode}"]`).checked=true;};
$('#card-printing-open').onclick=$('#settings-open').onclick;
$('#menu-open').onclick=()=>$('#menu-dialog').showModal();
$$('input[name="printing-choice"]').forEach(input=>input.onchange=()=>{$('#printing-mode').value=input.value;$('#printing-mode').dispatchEvent(new Event('change'));$('#settings-dialog').close();});
for(const id of ['settings-dialog','menu-dialog'])$('#'+id).addEventListener('click',e=>{if(e.target.id===id)$('#'+id).close();});
