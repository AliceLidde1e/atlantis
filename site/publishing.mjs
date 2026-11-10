// Shared by the offline editor, public result reader and pre-deploy validation.
export function validatePublishingData({cards=[],events=[],results=[],decks=[]}={}){
 const errors=[],object=x=>x&&typeof x==='object'&&!Array.isArray(x),text=x=>typeof x==='string'&&!!x.trim(),integer=x=>Number.isSafeInteger(x)&&x>=0;
 const fail=(path,message)=>errors.push(`${path}: ${message}`),sets={};
 for(const [kind,rows] of Object.entries({cards,events,results,decks})){
  sets[kind]=new Set();if(!Array.isArray(rows)){fail(kind,'配列が必要です');continue;}
  rows.forEach((row,i)=>{const p=`${kind}[${i+1}]`;if(!object(row)){fail(p,'オブジェクトが必要です');return;}if(!text(row.id)||sets[kind].has(row.id))fail(p,'IDが空欄または重複しています');sets[kind].add(row.id);});
 }
 if(errors.length)return errors;
 const byId=new Map(cards.map(c=>[c.id,c])),eventMap=new Map(events.map(e=>[e.id,e])),deckMap=new Map(decks.map(d=>[d.id,d]));
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const timestamp=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(?:\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(x)&&date(x.slice(0,10))&&Number.isFinite(Date.parse(x));
 events.forEach(e=>{
  const p=`events/${e.id}`;
  if(!text(e.title))fail(p,'名称が必要です');
  if(typeof e.sample!=='boolean')fail(p,'sampleはtrue/falseが必要です');
  if(e.start||e.end||!e.sample){if(!timestamp(e.start)||!timestamp(e.end)||Date.parse(e.start)>=Date.parse(e.end))fail(p,'開始・終了はタイムゾーン付き日時で、終了を後にしてください');}
  if(!e.sample&&(!text(e.venue)||!text(e.format)))fail(p,'会場と大会形式が必要です');
  if(e.entryUrl){try{const u=new URL(e.entryUrl);if(u.protocol!=='https:'||!u.hostname||u.username||u.password)throw Error();}catch{fail(p,'申込URLは認証情報を含まないHTTPSにしてください');}}
 });
 decks.forEach(d=>{
  const p=`decks/${d.id}`;
  for(const key of ['name','author','event','venue','result','source','sourceDeckId','englishText'])if(!text(d[key]))fail(p,`${key}が必要です`);
  if(d.sample!==false)fail(p,'公開デッキはsample:falseにしてください');
  if(d.heldOn!==undefined&&d.heldOn!==null&&d.heldOn!==''&&!date(d.heldOn))fail(p,'確認済み開催日は実在するYYYY-MM-DD形式です。未確認なら空欄にしてください');
  if(!Array.isArray(d.colors)||d.colors.some(c=>!['W','U','B','R','G'].includes(c))||new Set(d.colors).size!==d.colors.length)fail(p,'色はW,U,B,R,Gの重複しない配列です');
  if(!byId.has(d.hero))fail(p,'代表カードが辞書にありません');
  for(const zone of ['main','side']){
   const rows=d[zone];if(!Array.isArray(rows)){fail(p,`${zone}は配列が必要です`);continue;}
   const seen=new Set();let total=0;
   for(const row of rows){if(!object(row)||!byId.has(row.id)||!integer(row.qty)||row.qty<1||seen.has(row.id)){fail(p,`${zone}に未知・重複カードまたは不正枚数があります`);continue;}seen.add(row.id);total+=row.qty;}
   if(zone==='main'?total<60:total>15)fail(p,`${zone}の合計枚数が範囲外です`);
  }
  if(Array.isArray(d.main)&&Array.isArray(d.side)&&[...d.main,...d.side].every(r=>object(r)&&byId.has(r.id))){
   const rows=zone=>d[zone].map(r=>`${r.qty} ${byId.get(r.id).name}`).join('\n');
   if(d.englishText!==rows('main')+'\n\nSideboard\n'+rows('side')+'\n')fail(p,'英語テキストとカードID・枚数・順序が一致しません');
  }
 });
 const linked=new Set();
 results.forEach(r=>{
  const p=`results/${r.id}`;
  if(!text(r.title)||!text(r.venue)||!text(r.source))fail(p,'大会名・会場・出典が必要です');
  if(!date(r.date))fail(p,'開催日は実在するYYYY-MM-DD形式です');
  if(!integer(r.players)||r.players<1||!integer(r.topCut)||r.topCut<1||r.topCut>r.players)fail(p,'参加人数と公開枠が不正です');
  if(r.eventId&&(!eventMap.has(r.eventId)||eventMap.get(r.eventId).sample))fail(p,'正式イベントのIDを指定してください');
  if(r.sample!==undefined&&r.sample!==false)fail(p,'架空の大会結果は公開できません');
  if(!Array.isArray(r.standings)||!r.standings.length){fail(p,'通算成績が必要です');return;}
  if(r.standings.length>r.players)fail(p,'成績行が参加人数を超えています');
  const players=new Set();
  for(const s of r.standings){
   if(!object(s)){fail(p,'成績行はオブジェクトです');continue;}
   if(!integer(s.rank)||s.rank<1||s.rank>r.players||!text(s.player)||players.has(s.player))fail(p,'順位またはプレイヤー名が不正・重複です');players.add(s.player);
   if(!['wins','losses','draws'].every(k=>integer(s[k])))fail(p,'通算勝敗は0以上の整数です');
   if(s.deckId){
    const d=deckMap.get(s.deckId);
    if(s.rank>r.topCut||!d||linked.has(s.deckId))fail(p,'上位公開枠外・未知・重複のデッキ参照です');
    else if(d.author!==s.player||d.event!==r.title||d.venue!==r.venue)fail(p,'デッキと大会名・会場・プレイヤー名が一致しません');
    linked.add(s.deckId);
   }
  }
 });
 return errors;
}

export function confirmedDeckDate(deck){
 const value=deck.heldOn;
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value?value:'';
}
export function renderTournamentResults(results,decks){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const byId=new Map(decks.map(d=>[d.id,d]));
 return [...results].filter(r=>!r.sample).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).map(r=>`<article class="event-card tournament-result"><h3>${esc(r.title)}</h3><p><time datetime="${esc(r.date)}">${esc(r.date)}</time> · ${esc(r.venue)} · ${r.players}名</p><p class="hint">通算成績／上位${r.topCut}名のデッキを掲載</p><div class="result-table-wrap" tabindex="0" role="region" aria-label="${esc(r.title)}の通算成績"><table class="result-table"><thead><tr><th scope="col">順位</th><th scope="col">プレイヤー</th><th scope="col">通算成績</th><th scope="col">デッキ</th></tr></thead><tbody>${[...r.standings].sort((a,b)=>a.rank-b.rank).map(s=>`<tr><td>${s.rank}</td><td>${esc(s.player)}</td><td>${s.wins}勝${s.losses}敗${s.draws?`${s.draws}分`:''}</td><td>${s.rank<=r.topCut&&byId.has(s.deckId)?`<button class="link-button" data-deck="${esc(s.deckId)}">${esc(byId.get(s.deckId).name)}</button>`:'—'}</td></tr>`).join('')}</tbody></table></div><p class="hint">出典：${esc(r.source)}</p></article>`).join('');
}

// Historical decks use confirmed dates, never workbook/import timestamps.
const escapeResult=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eventResultHref(id){return '#events/'+encodeURIComponent(id);}
export function eventRoute(view){
 if(view==='events')return {page:'view-events',kind:'overview'};
 if(view==='events/results')return {page:'view-event-directory',kind:'results'};
 if(view==='events/announcements')return {page:'view-event-announcements',kind:'announcements'};
 if(!view.startsWith('events/'))return null;
 let id='';try{id=decodeURIComponent(view.slice('events/'.length));}catch{}
 return {page:'view-event-results',kind:'detail',id};
}
export function publishedDeckRank(value){
 const label=String(value??'').trim();
 if(label==='優勝')return 1;
 if(label==='準優勝')return 2;
 const match=/^(?:TOP\s*([1-9]\d*)|([1-9]\d*)位)$/i.exec(label);
 return match?Number(match[1]||match[2]):Infinity;
}
export function collectEventResults(decks,results=[]){
 const published=decks.filter(d=>d.sample===false),byId=new Map(published.map(d=>[d.id,d])),linked=new Set();
 const groups=results.filter(r=>!r.sample).map(r=>{
  const rows=r.standings.filter(s=>s.rank<=r.topCut&&byId.has(s.deckId)).map(s=>{
   linked.add(s.deckId);return {deck:byId.get(s.deckId),rank:s.rank,label:String(s.rank)};
  });
  const champions=r.standings.filter(s=>s.rank===1).map(s=>({player:s.player,deck:byId.get(s.deckId)||null}));
  return {id:'result-'+r.id,title:r.title,date:r.date,players:r.players,venue:r.venue,rows,champions};
 });
 const historical=new Map();
 for(const deck of published){
  if(linked.has(deck.id))continue;
  const date=confirmedDeckDate(deck),row={deck,rank:publishedDeckRank(deck.result),label:deck.result||'—'};
  const matches=groups.filter(g=>date&&g.title===deck.event&&g.date===date&&g.venue===deck.venue);
  if(matches.length===1){matches[0].rows.push(row);continue;}
  // Without a confirmed date, do not merge potentially different occurrences.
  const key=JSON.stringify([deck.event,deck.venue,date||deck.id]);
  if(!historical.has(key))historical.set(key,{title:deck.event,date,players:null,venue:deck.venue,rows:[]});
  historical.get(key).rows.push(row);
 }
 for(const group of historical.values()){
  group.id='decks-'+group.rows.map(r=>r.deck.id).sort()[0];groups.push(group);
 }
 for(const group of groups)group.rows.sort((a,b)=>a.rank-b.rank||(a.deck.order??Infinity)-(b.deck.order??Infinity)||a.deck.id.localeCompare(b.deck.id));
 return groups.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'ja')||a.id.localeCompare(b.id));
}
function eventResultFacts(group){
 const esc=escapeResult;
 return `<dl class="event-result-facts"><div><dt>開催日</dt><dd>${group.date?`<time datetime="${esc(group.date)}">${esc(group.date)}</time>`:'未確認'}</dd></div><div><dt>参加人数</dt><dd>${Number.isSafeInteger(group.players)&&group.players>0?`${group.players}名`:'未確認'}</dd></div></dl>`;
}
export function eventChampions(group){
 // TOP4/TOP8 and the first listed deck do not establish a winner.
 return group.champions??group.rows.filter(row=>/^(?:優勝|1位)$/.test(String(row.label).trim())).map(row=>({player:row.deck.author,deck:row.deck}));
}
export function eventPlaceholder(label='EVENT RESULTS'){
 return `<div class="printing-image event-placeholder"><img src="atlantis-logo.svg?v=20261110split" alt="" loading="lazy" decoding="async"><span>${escapeResult(label)}</span></div>`;
}
export function renderEventSummary(group,renderImage=()=> ''){
 const esc=escapeResult,champions=eventChampions(group),heroDeck=champions.find(winner=>winner.deck?.hero)?.deck;
 const image=heroDeck?renderImage(heroDeck):'';
 const winner=champions.length?champions.map(w=>esc(w.player)).join(' / '):'優勝者未確認';
 const deckNames=champions.map(w=>esc(w.deck?.name||'デッキ未掲載')).join(' / ');
 return `<article class="deck-card featured-card event-tile event-result-summary"><a class="featured-open" href="${esc(eventResultHref(group.id))}" aria-label="${esc(group.title)}${group.date?' · '+esc(group.date):''}の大会結果">${image||eventPlaceholder()}<div class="content"><span class="eyebrow">EVENT RESULTS</span><h3>${esc(group.title)}</h3><p class="published-deck-date">開催日：${group.date?`<time datetime="${esc(group.date)}">${esc(group.date)}</time>`:'未確認'}</p><dl class="event-card-facts"><div><dt>会場</dt><dd>${esc(group.venue||'未確認')}</dd></div><div><dt>参加人数</dt><dd>${Number.isSafeInteger(group.players)&&group.players>0?`${group.players}名`:'未確認'}</dd></div></dl><div class="event-champion"><span class="eyebrow">WINNER</span><p>${winner}</p>${deckNames?`<p class="event-winner-deck">${deckNames}</p>`:''}</div><span class="event-card-action">View Decks →</span></div></a></article>`;
}
export function renderPublishedDeckResults(decks,results=[],{limit=Infinity,renderImage}={}){
 return collectEventResults(decks,results).slice(0,limit).map(group=>renderEventSummary(group,renderImage)).join('');
}
export function renderEventResult(group){
 const esc=escapeResult;
 return `<div class="section-head"><h1 id="event-result-title">${esc(group.title)}</h1></div>${eventResultFacts(group)}<h2>Decks</h2>${group.rows.length?`<table class="event-deck-table"><thead><tr><th scope="col">順位</th><th scope="col">使用者</th><th scope="col">デッキ名</th></tr></thead><tbody>${group.rows.map(row=>`<tr><td data-label="順位">${esc(row.label)}</td><td data-label="使用者">${esc(row.deck.author)}</td><td data-label="デッキ名"><button class="link-button" type="button" data-deck="${esc(row.deck.id)}">${esc(row.deck.name)}</button></td></tr>`).join('')}</tbody></table>`:'<p>掲載デッキはまだありません。</p>'}`;
}
