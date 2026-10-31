import {parseDeck,deckHeading,setPoolQuantity,movePoolCard,DECK_TEXT_LIMIT} from './core.mjs?v=20261031a';

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
