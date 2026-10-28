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

export function renderPublishedDeckResults(decks,results=[],artForDeck=()=>''){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=decks.filter(d=>d.sample===false).map((d,index)=>({d,index})).sort((a,b)=>(a.d.order??a.index)-(b.d.order??b.index)||a.index-b.index).slice(0,5).map(x=>x.d);
 if(!rows.length)return '';
 return '<section class="recent-standings"><h3>直近の入賞リスト</h3>'+rows.map(d=>`<article class="event-card recent-deck"><div class="recent-deck-info"><h4><button class="link-button" data-deck="${esc(d.id)}">${esc(d.name)}</button></h4><p>${esc(d.result)} · ${esc(d.author)}</p><p>${esc(d.event)} · ${esc(d.venue)}</p>${confirmedDeckDate(d)?`<time datetime="${confirmedDeckDate(d)}">${confirmedDeckDate(d)}</time>`:''}</div>${artForDeck(d)?`<button class="recent-deck-art" type="button" data-deck="${esc(d.id)}" aria-label="${esc(d.name)} details">${artForDeck(d)}</button>`:''}</article>`).join('')+'</section>';
}
