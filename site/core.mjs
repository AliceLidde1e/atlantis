import {applyJapaneseNameCorrection} from './japanese-names.mjs';
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function externalEntryUrl(value){if(!value)return null;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export const colorNames = {W:'白',U:'青',B:'黒',R:'赤',G:'緑',C:'無色',A:'Artifacts'};
export const types = {Creature:'クリーチャー',Instant:'インスタント',Sorcery:'ソーサリー',Enchantment:'エンチャント',Artifact:'アーティファクト',Land:'土地',Planeswalker:'プレインズウォーカー'};
export const subtypeNames = {Angel:'天使',Human:'人間',Wizard:'ウィザード',Goblin:'ゴブリン',Elf:'エルフ',Bird:'鳥',Dog:'犬',Hound:'猟犬',Wurm:'ワーム',Beast:'ビースト',Spirit:'スピリット',Zombie:'ゾンビ',Skeleton:'スケルトン',Vampire:'吸血鬼',Dragon:'ドラゴン',Elemental:'エレメンタル',Soldier:'兵士',Knight:'騎士',Cleric:'クレリック',Shaman:'シャーマン',Druid:'ドルイド',Merfolk:'マーフォーク',Faerie:'フェアリー',Illusion:'イリュージョン',Incarnation:'インカーネーション',Cat:'猫',Wall:'壁',Giant:'巨人',Demon:'デーモン',Rat:'ネズミ',Spider:'蜘蛛',Insect:'昆虫',Snake:'蛇',Bear:'熊',Ogre:'オーガ',Warrior:'戦士',Scout:'スカウト',Rogue:'ならず者',Assassin:'暗殺者',Nightmare:'ナイトメア',Avatar:'アバター',Island:'島',Forest:'森',Plains:'平地',Mountain:'山',Swamp:'沼',Aura:'オーラ'};
export const oracleWords = {'飛行':'flying','速攻':'haste','トランプル':'trample','先制攻撃':'first strike','警戒':'vigilance','到達':'reach','防衛':'defender','再生':'regenerate','プロテクション':'protection','サイクリング':'cycling','フラッシュバック':'flashback','マッドネス':'madness','変異':'morph','打ち消す':'counter target','打ち消し':'counter target','カードを引く':'draw','ドロー':'draw','破壊':'destroy','生け贄':'sacrifice','墓地':'graveyard','追放':'exile'};
export function subtypes(card){return String(card.type).split(' // ').flatMap(face => (face.split(' — ')[1] || '').split(/\s+/).filter(Boolean));}
export function prepare(card){card=applyJapaneseNameCorrection(card);return {...card, nameIndex:normalize(card.name+' '+card.ja), oracleIndex:normalize(card.oracle), subtypeIndex:normalize(subtypes(card).flatMap(s=>[s,subtypeNames[s]||'']).join(' '))};}
export function oracleMatch(card,query){const q=normalize(query);if(!q)return true;const translated=oracleWords[q];return card.oracleIndex.includes(q)||(translated ? card.oracleIndex.includes(translated) : false);}
export function colorsMatch(actual=[],selected=[],mode='includes'){
  if(!selected.length)return true;
  const colors=actual.length ? actual : ['C'];
  return mode==='exact'?selected.every(c=>colors.includes(c))&&colors.length===selected.length:selected.some(c=>colors.includes(c));
}
export function cardColorsMatch(card,selected=[],mode='includes'){
 const colors=selected.filter(c=>c!=='A'),artifact=card.type.split(' // ').some(face=>(face.split(' — ')[0]||'').split(' ').includes('Artifact'));
 if(mode==='exact')return (!selected.includes('A')||artifact)&&colorsMatch(card.colors,colors,mode);
 return !selected.length||(colors.length>0&&colorsMatch(card.colors,colors,mode))||(selected.includes('A')&&artifact);
}
export function cardMatches(c,f){return (!normalize(f.name)||c.nameIndex.includes(normalize(f.name)))&&oracleMatch(c,f.oracle)&&(!normalize(f.keyword)||c.nameIndex.includes(normalize(f.keyword))||c.subtypeIndex.includes(normalize(f.keyword))||oracleMatch(c,f.keyword))&&cardColorsMatch(c,f.colors,f.colorMode)&&(!f.type||c.type.split(' // ').some(v=>(v.split(' — ')[0]||'').split(' ').includes(f.type)))&&(f.min===''||c.mv>=Number(f.min))&&(f.max===''||c.mv<=Number(f.max));}
export function deckMatches(d,f,cards){
  if(normalize(f.query)&&!normalize([d.name,d.author,d.event,d.venue,d.result].filter(Boolean).join(' ')).includes(normalize(f.query)))return false;
  if(!colorsMatch(d.colors,f.colors,f.colorMode)||f.archetype&&d.archetype!==f.archetype)return false;
  const lines=[...d.main,...(f.side?d.side:[])];
  return (f.cards||[]).every(id=>lines.some(line=>line.id===id));
}
export const DECK_TEXT_LIMIT=201000;
export function unifiedDeckText(record){
  return record.side ? record.main+(record.main?'\n\n':'')+'Sideboard\n'+record.side : record.main;
}
function readDeck(record,version,{local=false}={}){
  const d=record;
  if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>200||typeof d.note!=='string'||d.note.length>100000)throw new Error('デッキ名または保存データが不正です。');
  if(version===1&&['main','side'].some(k=>typeof d[k]!=='string'||d[k].length>100000))throw new Error('旧形式の本文が不正です。');
  const text=version===1?unifiedDeckText(d):d.text;
  if(typeof text!=='string'||text.length>DECK_TEXT_LIMIT)throw new Error('本文は201,000文字以内にしてください。');
  if((local||d.updated!==undefined)&&(typeof d.updated!=='string'||!Number.isFinite(Date.parse(d.updated))))throw new Error('更新日時が不正です。');
  if(local&&(typeof d.id!=='string'||!d.id))throw new Error('保存IDが不正です。');
  return {id:local?d.id:crypto.randomUUID(),name:d.name.trim(),text,note:d.note,updated:d.updated?new Date(d.updated).toISOString():new Date().toISOString()};
}
export function validateBackup(data){
  if(!data||data.format!=='atlantis-local-decks'||![1,2].includes(data.version)||!Array.isArray(data.decks)||data.decks.length>1000)throw new Error('ATLANTISのバックアップ形式を確認してください。');
  return data.decks.map(d=>readDeck(d,data.version));
}
export function createBackup(decks){return {format:'atlantis-local-decks',version:2,exportedAt:new Date().toISOString(),decks:decks.map(d=>{const {name,text,note,updated}=readDeck(d,typeof d.text==='string'?2:1,{local:true});return {name,text,note,updated};})};}
export function validateLocalState(value){
  if(!value||![1,2].includes(value.version)||!Array.isArray(value.decks)||!Array.isArray(value.trash)||value.decks.length>1000)throw new Error('保存データの形式が不正です。');
  const seen=new Set();
  const read=d=>{const row=readDeck(d,value.version,{local:true});if(seen.has(row.id))throw new Error('保存IDが重複しています。');seen.add(row.id);return row;};
  return {version:2,decks:value.decks.map(read),trash:value.trash.map(read)};
}
export function appendBackup(current,data){
  const valid=validateLocalState(current),imported=validateBackup(data);
  if(valid.decks.length+imported.length>1000)throw new Error('復元後のデッキ数は1,000件以内にしてください。');
  return {...valid,decks:[...imported,...valid.decks]};
}
export function insertDeckText(text,insertion,start=text.length,end=start,line=false){
  if(typeof text!=='string'||typeof insertion!=='string')throw new Error('本文を確認してください。');
  start=Math.max(0,Math.min(text.length,Number.isFinite(start)?start:text.length));end=Math.max(start,Math.min(text.length,Number.isFinite(end)?end:start));
  if(!insertion)return {text,caret:start};
  const before=text.slice(0,start),after=text.slice(end);
  const added=(line&&before&&!before.endsWith('\n')?'\n':'')+insertion+(line&&after&&!after.startsWith('\n')?'\n':'');
  const next=before+added+after;
  if(next.length>DECK_TEXT_LIMIT)throw new Error('本文は201,000文字以内にしてください。');
  return {text:next,caret:before.length+added.length};
}
export function addSearchCard(text,card,quantity,start=text.length,end=start){
  if(!card||typeof card.name!=='string'||!Number.isInteger(quantity)||quantity<1||quantity>1000)throw new Error('追加枚数は1〜1,000の整数で指定してください。');
  const caret=Math.max(start,end);
  return insertDeckText(text,quantity+' '+(card.ja||card.name),caret,caret,true);
}
export function stageSearchCard(pool,card,zone){
  if(!card?.id||typeof card.name!=='string'||!['main','side'].includes(zone))throw new Error('追加先を確認してください。');
  const previous=pool.find(item=>item.id===card.id&&item.zone===zone);
  if(previous&&previous.qty>=1000)throw new Error('同じカードの一時プールは区分ごとに1,000枚以内にしてください。');
  return previous?pool.map(item=>item.id===card.id&&item.zone===zone?{...item,qty:item.qty+1}:item):[...pool,{id:card.id,zone,qty:1}];
}
export function applyCardPool(text,pool,cards){
  if(typeof text!=='string')throw new Error('本文を確認してください。');
  const lines={main:[],side:[]};
  for(const item of pool){
    const card=cards.get(item.id);
    if(!card||!['main','side'].includes(item.zone)||!Number.isInteger(item.qty)||item.qty<1||item.qty>1000)throw new Error('一時プールのカード情報を確認できません。');
    lines[item.zone].push(`${item.qty} ${card.ja||card.name}`);
  }
  let result=text;
  if(lines.main.length){
    const headings=[...result.matchAll(/^.*$/gm)].filter(m=>deckHeading(m[0])==='side');if(headings.length>1)throw new Error('サイド見出しが複数あります。本文で区分を確認してください。');const heading=headings[0];
    const pos=heading?heading.index:result.length;
    result=insertDeckText(result,lines.main.join('\n'),pos,pos,true).text;
  }
  if(lines.side.length){
    const headings=[...result.matchAll(/^.*$/gm)].filter(m=>deckHeading(m[0])==='side');if(headings.length>1)throw new Error('サイド見出しが複数あります。本文で区分を確認してください。');const heading=headings[0];
    result=insertDeckText(result,(heading?'':'Sideboard\n')+lines.side.join('\n'),result.length,result.length,true).text;
  }
  return result;
}
export function setPoolQuantity(pool,id,zone,qty){
  if(!['main','side'].includes(zone)||!Number.isInteger(qty)||qty<0||qty>1000)throw new Error('枚数は0〜1,000の整数で入力してください。');
  if(!qty)return pool.filter(x=>!(x.id===id&&x.zone===zone));
  if(pool.some(x=>x.id===id&&x.zone===zone))return pool.map(x=>x.id===id&&x.zone===zone?{...x,qty}:x);
  return [...pool,{id,zone,qty}];
}
export function movePoolCard(pool,id,from){
  const item=pool.find(x=>x.id===id&&x.zone===from);
  if(!item)throw new Error('移動するカードがありません。');
  const to=from==='main'?'side':'main',qty=pool.find(x=>x.id===id&&x.zone===to)?.qty||0;
  if(qty>=1000)throw new Error('移動先は1,000枚以内にしてください。');
  return setPoolQuantity(setPoolQuantity(pool,id,from,item.qty-1),id,to,qty+1);
}
export function validatePoolRecovery(value,cards){
  if(value?.version!==1||!Array.isArray(value.pool)||value.pool.length>cards.size*2||typeof value.target!=='string'||typeof value.name!=='string'||value.name.length>200||typeof value.note!=='string'||value.note.length>100000)throw new Error('未保存データの形式を確認してください。');
  const seen=new Set();
  for(const item of value.pool){const key=item.id+':'+item.zone;if(!cards.has(item.id)||!['main','side'].includes(item.zone)||!Number.isInteger(item.qty)||item.qty<1||item.qty>1000||seen.has(key))throw new Error('未保存データのカード・枚数を確認してください。');seen.add(key);}
  return {version:1,pool:value.pool.map(x=>({id:x.id,zone:x.zone,qty:x.qty})),target:value.target,name:value.name,note:value.note};
}
export function validOptionalDate(value){return value==null||value===''||(typeof value==='string'&&Number.isFinite(Date.parse(value)));}
export function eventDate(value){return value==null||value===''?'未定':!validOptionalDate(value)?'日時を確認中':new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
export function eventSortKey(event){return event.start?Date.parse(event.start):Infinity;}

export function deckHeading(line){const s=normalize(line).replace(/\s*\(\d+\)\s*$/,'').replace(/:$/,'').trim();return ['sideboard','サイドボード'].includes(s)?'side':['main','mainboard','メイン','メインボード'].includes(s)?'main':null;}
export function parseDeck(text,cards){
 const names=new Map();for(const c of cards.values())for(const name of [c.name,c.ja].filter(Boolean)){const key=normalize(name);if(!names.has(key))names.set(key,new Set());names.get(key).add(c.id);}
 const exact=s=>{const ids=names.get(normalize(s));return ids?.size===1?[...ids][0]:null;};
 let zone='main',sideHeadings=0;const rows=[],unknown=[];
 text.split(/\r?\n/).forEach((raw,i)=>{if(!raw.trim())return;const heading=deckHeading(raw);if(heading){zone=heading;if(zone==='side')sideHeadings++;return;}const m=normalize(raw).match(/^([1-9]\d*)\s+(.+)$/);let id=null,qty=m?Number(m[1]):0;
 if(m&&Number.isSafeInteger(qty)){id=exact(m[2]);if(!id){const pair=m[2].split(/(?<!\/)\/(?!\/)/);if(pair.length===2){const a=exact(pair[0]),b=exact(pair[1]);if(a&&a===b)id=a;}}}
 if(!id){unknown.push({line:i+1,text:raw});return;}const row=rows.find(x=>x.id===id&&x.zone===zone);if(row)row.qty+=qty;else rows.push({id,zone,qty});});
 return {rows,unknown,sideHeadings};
}
export function printingCaption(print){return print?`${print.lang.toUpperCase()} ${print.set.toUpperCase()} #${print.number}`:'';}
export function printingFallbackReason(record,mode,chosen,{imageFailed=false}={}){
 if(!chosen)return '画像を取得できません';
 const lang=mode==='ja'?'ja':'en',target=record?.[lang]?.target,labels=[];
 if(chosen.lang!==lang)labels.push(chosen.lang==='ja'?'日本語版':'英語版');
 if(chosen.regular===false)labels.push(chosen.promo?'プロモ版':'特殊仕様版');
 if(Array.isArray(chosen.finishes)&&!chosen.finishes.includes('nonfoil'))labels.push(chosen.finishes.includes('foil')?'FOIL版':'特殊加工版');
 const why=imageFailed?'画像取得失敗':!target?(lang==='ja'?'日本語版なし':'英語版なし'):chosen.id!==target.id?'指定版の画像なし':labels.length?'通常・非FOIL版なし':'';
 return why?`代替表示：${labels.join('／')||'別の印刷版'}（${why}）`:'';
}
export function printingOptions(record,mode){
 const lang=mode==='ja'?'ja':'en',other=lang==='ja'?'en':'ja';if(!record)return {target:null,choices:[],reason:'表示版データを確認できません'};
 const target=record[lang]?.target||null,choices=[];const seen=new Set();
 for(const key of [lang,other])for(const p of [record[key]?.target,...(record[key]?.candidates||[])])if(p?.image&&!seen.has(p.id)){choices.push(p);seen.add(p.id);}
 const first=choices[0],reason=printingFallbackReason(record,mode,first);
 return {target,choices,reason};
}
export function validateDraftRecovery(value){
 if(value?.version!==1||!(value.baseline===null||typeof value.baseline==='string')||!(value.revision===null||typeof value.revision==='string'))throw new Error('退避データが不正です。');
 const read=d=>{if(!d||['id','name','text','note'].some(k=>typeof d[k]!=='string')||d.id.length>200||d.name.length>200||d.text.length>DECK_TEXT_LIMIT||d.note.length>100000)throw new Error('退避した入力を読み取れません。');return Object.fromEntries(['id','name','text','note'].map(k=>[k,d[k]]));};
 return {version:1,draft:read(value.draft),base:read(value.base),baseline:value.baseline,revision:value.revision};
}
export function canDismissBackdrop(start,end){return start===true&&end===true;}
