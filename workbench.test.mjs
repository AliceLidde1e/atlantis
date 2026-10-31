import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDeck,createBackup,appendBackup} from './site/core.mjs';
import {setDeckQuantity,moveDeckCard,officialDeckText} from './site/workbench.mjs';
const map=new Map(JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url))).cards.map(c=>[c.id,c]));
const card=[...map.values()].find(c=>c.name==='Counterspell');
const initial='Mainboard\n3 Counterspell\n# preserve this note\n\nSideboard\n1 対抗呪文\n\nMaybeboard\n2 Counterspell';
const counts=text=>Object.fromEntries(['main','side','maybe'].map(z=>[z,parseDeck(text,map).rows.find(x=>x.id===card.id&&x.zone===z)?.qty||0]));
assert.deepEqual(counts(initial),{main:3,side:1,maybe:2});
for(const from of ['main','side','maybe'])for(const to of ['main','side','maybe']){
 if(from===to)continue;
 const result=moveDeckCard(initial,map,card.id,from,to),expected=counts(initial);expected[from]--;expected[to]++;
 assert.deepEqual(counts(result),expected);
 assert.ok(result.includes('# preserve this note'));
}
const removed=setDeckQuantity(initial,map,card.id,'maybe',0);
assert.deepEqual(counts(removed),{main:3,side:1,maybe:0});
for(const text of ['', 'Sideboard\n1 Counterspell','Maybeboard\n2 Counterspell','3 Counterspell\nMaybeboard\n2 Counterspell']){
 const result=setDeckQuantity(text,map,card.id,'side',4);
 assert.equal(counts(result).side,4);assert.deepEqual(parseDeck(result,map).unknown,[]);
}
const duplicates='1 Counterspell\n2 対抗呪文\nSideboard\n1 Counterspell';
assert.deepEqual(counts(setDeckQuantity(duplicates,map,card.id,'main',2)),{main:2,side:1,maybe:0});
assert.throws(()=>setDeckQuantity(initial,map,card.id,'maybe',1.5));
assert.throws(()=>setDeckQuantity(initial,map,card.id,'maybe',-1));
const text=initial.replace('# preserve this note\n','');
assert.equal(officialDeckText(text,map),'3 Counterspell\n\nSideboard\n1 Counterspell\n');
const state={version:2,decks:[{id:'x',name:'Example',text,note:'',updated:'2026-10-31T00:00:00Z'}],trash:[]};
const restored=appendBackup({version:2,decks:[],trash:[]},createBackup(state.decks));
assert.deepEqual(counts(restored.decks[0].text),{main:3,side:1,maybe:2});
const legacy=appendBackup({version:2,decks:[],trash:[]},{format:'atlantis-local-decks',version:1,decks:[{name:'Old',main:'3 Counterspell',side:'1 Counterspell',note:''}]});
assert.deepEqual(counts(legacy.decks[0].text),{main:3,side:1,maybe:0});
console.log('Workbench: six moves, section counts, freeform preservation, legacy backups, Maybe round trip and official export OK');
