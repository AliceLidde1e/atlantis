import {parseDeck,deckCardLookup,resolveDeckCard,normalize,deckHeading,setPoolQuantity,movePoolCard,DECK_TEXT_LIMIT} from './core.mjs?v=20261113deckview';

export const zones = {main:'Main',side:'Side',maybe:'Maybe'};
export const destinations = {main:[['side','→S'],['maybe','→?']],side:[['main','←M'],['maybe','→?']],maybe:[['main','←M'],['side','←S']]};

// Change only matching lines in the selected section. Unknown/freeform lines,
// other sections, and the user's original spelling remain intact.
export function setDeckQuantity(text, cards, id, zone, quantity) {
  if (!zones[zone] || !cards.has(id)) throw new Error('カードと区分を確認してください。');
  setPoolQuantity([],id,zone,quantity);
  const parsed = parseDeck(text,cards), unknown = new Set(parsed.unknown.map(x=>x.line));
  const lines = text.split(/\r?\n/); let current='main', inserted=false;
  const next=[];
  lines.forEach((line,index) => {
    const heading=deckHeading(line); if(heading){current=heading;next.push(line);return;}
    const row = !unknown.has(index+1) && parseDeck(line,cards).rows[0];
    if(current===zone && row?.id===id){
      if(!inserted && quantity) next.push(`${quantity} ${cards.get(id).name}`);
      inserted=true; return;
    }
    next.push(line);
  });
  if(!inserted && quantity){
    const cardLine=`${quantity} ${cards.get(id).name}`;
    let active='main', at=next.length, found=zone==='main';
    for(let i=0;i<next.length;i++){
      const heading=deckHeading(next[i]);
      if(!heading)continue;
      if(active===zone && heading!==zone && found){at=i;break;}
      active=heading; if(heading===zone){found=true;at=next.length;}
    }
    if(!found)next.push('',zone==='side'?'Sideboard':'Maybeboard',cardLine);
    else next.splice(at,0,cardLine);
  }
  const result=next.join('\n');
  if(result.length>DECK_TEXT_LIMIT)throw new Error('本文は201,000文字以内にしてください。');
  return result;
}
export function moveDeckCard(text,cards,id,from,to){
  const rows=parseDeck(text,cards).rows, next=movePoolCard(rows,id,from,to);
  const count=zone=>next.find(x=>x.id===id&&x.zone===zone)?.qty||0;
  return setDeckQuantity(setDeckQuantity(text,cards,id,from,count(from)),cards,id,to,count(to));
}
export function officialDeckText(text,cards){
  const parsed=parseDeck(text,cards);
  if(parsed.unknown.length)throw new Error('読み取れない行があります。Textで確認してください。');
  return ['main','side'].map(zone=>{
    const lines=parsed.rows.filter(x=>x.zone===zone).map(x=>`${x.qty} ${cards.get(x.id).name}`);
    return lines.length?(zone==='side'?'Sideboard\n':'')+lines.join('\n'):'';
  }).filter(Boolean).join('\n\n')+'\n';
}

const importHeadings=new Map([
  ['deck','main'],['main deck','main'],['side','side'],['sb','side'],
  ['about','about'],['commander','unsupported'],['companion','unsupported'],
  ['tokens','unsupported'],
]);

export function previewDeckImport(text,cards,{allMain=false}={}){
  if(text.length>DECK_TEXT_LIMIT)throw new Error('本文は201,000文字以内にしてください。');
  const lookup=deckCardLookup(cards),rows=new Map(),issues=[];
  const entries=[];
  let zone='main',explicit=false,block=0,blank=false,started=false;
  for(const [index,raw] of text.split(/\r\n?|\n/).entries()){
    const value=normalize(raw),line=index+1;
    if(!value){if(started)blank=true;continue;}
    const section=value.replace(/^\/\/\s*/,'').replace(/:$/,'').replace(/\s*\(\d+\)$/,'').trim();
    const heading=deckHeading(section)||importHeadings.get(section);
    if(heading){
      zone=heading;
      if(zone!=='about')explicit=true;
      if(zone==='unsupported')issues.push({line,raw,reason:'対応していない区分です。'});
      continue;
    }
    if(zone==='about'&&/^name\s/.test(value))continue;
    if(/^(?:\/\/|#)\s/.test(value))continue;
    const side=/^sb\s*:\s*/.test(value);
    if(side)explicit=true;
    if(blank){block++;blank=false;}
    started=true;
    entries.push({line,raw,value:side?value.replace(/^sb\s*:\s*/,''):value,zone:side?'side':zone,block});
  }
  const ambiguous=!explicit&&block>1&&!allMain;
  for(const entry of entries){
    const {value,line,raw}=entry;
    if(entry.zone==='unsupported'){
      issues.push({line,raw,reason:'対応していない区分のカードです。'});
      continue;
    }
    const match=value.match(/^([1-9]\d*)(?:\s*[x×]\s*|\s+)(\S.*)$/);
    const qty=match?Number(match[1]):0;
    if(!Number.isSafeInteger(qty)||qty<1||qty>1000){
      issues.push({line,raw,reason:'行頭に1〜1000の枚数を指定してください。'});
      continue;
    }
    const name=match[2];
    const stripped=name.replace(/(?:\s+\[[^\]]*\]|\s+\^[^^]*\^|\s+\*(?:f|e|cmdr)\*)+$/g,'')
      .replace(/\s+\([a-z0-9]{2,10}\)(?:\s+[a-z0-9★-]+)?$/,'');
    const id=resolveDeckCard(name,lookup)||resolveDeckCard(stripped,lookup);
    if(!id){
      issues.push({line,raw,reason:'旧枠モダンのカードデータで名前を照合できません。'});
      continue;
    }
    const target=explicit?(entry.zone==='about'?'main':entry.zone):!allMain&&block===1&&entry.block===1?'side':'main';
    const key=target+':'+id,total=(rows.get(key)?.qty||0)+qty;
    if(total>1000){issues.push({line,raw,reason:'同じ区分の同名カードが合計1,000枚を超えています。'});continue;}
    rows.set(key,{id,zone:target,qty:total});
  }
  const totals={main:0,side:0,maybe:0};
  for(const row of rows.values())totals[row.zone]+=row.qty;
  const result=Object.keys(zones).map(target=>{
    const lines=[...rows.values()].filter(row=>row.zone===target).map(row=>`${row.qty} ${cards.get(row.id).name}`);
    if(lines.length&&target!=='main')lines.unshift(target==='side'?'Sideboard':'Maybeboard');
    return lines.join('\n');
  }).filter(Boolean).join('\n\n');
  if(result.length>DECK_TEXT_LIMIT)throw new Error('変換後の本文が201,000文字を超えています。');
  return {text:result,totals,issues:issues.sort((a,b)=>a.line-b.line),ambiguous,blankSide:!explicit&&block===1&&!allMain};
}
