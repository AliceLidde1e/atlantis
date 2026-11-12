import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDeck,createBackup,appendBackup,validateLocalState,validateDraftRecovery} from './site/core.mjs';
import {setDeckQuantity,moveDeckCard,officialDeckText,previewDeckImport} from './site/workbench.mjs';
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

const importCases=[
  ['MO with blank separator','3 Counterspell\r\n\r\n1 Counterspell',3,1],
  ['Arena-style export','About\nName Sample\n\nDeck\n3 Counterspell (DMR) 45\n\nSideboard\n1 Counterspell (DMR) 45',3,1],
  ['Moxfield-style export','3 Counterspell (DMR) 45 *F*\n\nSIDEBOARD:\n1 Counterspell (DMR) 45',3,1],
  ['Archidekt-style export','// Main\n3x Counterspell (dmr) 45 [Removal] ^Have,#37d67a^\n// Sideboard\n1x Counterspell (dmr) 45',3,1],
  ['Japanese and English','２× 対抗呪文\n1 x 対抗呪文 / Counterspell\nSB: 1 Counterspell',3,1],
];
for(const [label,input,main,side] of importCases){
  const result=previewDeckImport(input,map);
  assert.deepEqual(result.issues,[],label);
  assert.deepEqual(result.totals,{main,side,maybe:0},label);
  assert.equal(officialDeckText(result.text,map),'3 Counterspell\n\nSideboard\n1 Counterspell\n',label);
}
const unmarked='1 Counterspell\n\n1 Counterspell\n\n1 Counterspell';
assert.equal(previewDeckImport(unmarked,map).ambiguous,true);
assert.equal(previewDeckImport(unmarked,map,{allMain:true}).totals.main,3);
assert.equal(previewDeckImport('1 Counterspell\n1 Unrecognized Card',map).issues[0].line,2);
assert.equal(previewDeckImport('Commander (1):\n1 Counterspell',map).issues.length,2);
assert.equal(previewDeckImport('1000 Counterspell\n1 Counterspell',map).issues[0].line,2);
assert.equal(previewDeckImport('Maybeboard\n1 Counterspell',map).totals.maybe,1);
const withThumbnail={...state.decks[0],thumbnailId:card.id};
assert.equal(validateLocalState({...state,decks:[withThumbnail]}).decks[0].thumbnailId,card.id);
assert.equal(appendBackup({version:2,decks:[],trash:[]},createBackup([withThumbnail])).decks[0].thumbnailId,card.id);
const draft=validateDraftRecovery({version:1,draft:withThumbnail,base:state.decks[0],baseline:null,revision:null});
assert.equal(draft.draft.thumbnailId,card.id);
assert.equal(draft.base.thumbnailId,'');
