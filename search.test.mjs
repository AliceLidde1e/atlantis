import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {archetypeEnglish,prepare,cardMatches,deckMatches,colorsMatch,validateLocalState,createBackup} from './site/core.mjs';
const cards=JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url))).cards.map(prepare);
const filters={name:'',oracle:'',keyword:'',colors:[],colorMode:'includes',type:'',min:'',max:''};
const artifact=c=>c.type.split(' // ').some(face=>(face.split(' — ')[0]||'').split(' ').includes('Artifact'));
for(const selection of [[],['U'],['U','G'],['C','U'],['A'],['A','U'],['A','C']]){
 const expected=cards.filter(c=>!selection.length||selection.some(s=>s==='A'?artifact(c):s==='C'?!c.colors.length:c.colors.includes(s))).map(c=>c.id);
 assert.deepEqual(cards.filter(c=>cardMatches(c,{...filters,colors:selection})).map(c=>c.id),expected);
}
assert(colorsMatch(['U'],['U','G']));
assert(!colorsMatch(['U'],['U','G'],'exact'));
assert(colorsMatch(['U','G'],['U','G'],'exact'));
assert(cards.filter(c=>cardMatches(c,{...filters,colors:['A','U'],colorMode:'exact'})).every(c=>artifact(c)&&c.colors.length===1&&c.colors[0]==='U'));
const decks=JSON.parse(readFileSync(new URL('./site/data/decks.json',import.meta.url)));
const df={query:'',cards:[],side:false,colors:['U','G'],colorMode:'includes',archetype:''};
assert.deepEqual(decks.filter(d=>deckMatches(d,df,new Map())).map(d=>d.id),decks.filter(d=>d.colors.includes('U')||d.colors.includes('G')).map(d=>d.id));
const saved={id:'legacy',name:'Deck',text:'1 Island',note:'Existing note',updated:'2026-10-24T00:00:00Z'};
assert.equal(createBackup(validateLocalState({version:2,decks:[saved],trash:[]}).decks).decks[0].note,saved.note);
console.log('Search regression: OR colors, colorless, artifacts, Exact, decks, legacy notes OK');

for(const d of decks){assert(archetypeEnglish[d.archetype],`Missing English archetype: ${d.archetype}`);assert(!/[\u3040-\u30ff\u3400-\u9fff]/.test(archetypeEnglish[d.archetype]));}

// Multi-select types are a union, including multi-type cards and both faces.
for(const selected of [[],['Creature'],['Creature','Instant'],['Artifact','Land']]){
 const expected=cards.filter(c=>(!selected.length||c.type.split(' // ').some(face=>selected.some(type=>face.split(' — ')[0].split(' ').includes(type))))&&c.mv>=2&&c.mv<=4).map(c=>c.id);
 assert.deepEqual(cards.filter(c=>cardMatches(c,{...filters,types:selected,min:'2',max:'4'})).map(c=>c.id),expected);
}
const dual=prepare({name:'Type fixture',ja:'',oracle:'',type:'Artifact Creature — Construct',colors:[],mv:3});
assert(cardMatches(dual,{...filters,types:['Artifact','Instant']}));
assert(!cardMatches(dual,{...filters,types:['Land','Instant']}));
assert(!cardMatches(dual,{...filters,types:['Artifact'],max:'2'}));
assert(cardMatches(prepare({...dual,type:'Instant // Sorcery'}),{...filters,types:['Sorcery']}));
console.log('Multi-select types: OR, multi-type, second face, combined mana bounds OK');

// AND requires every chosen condition, while allowing additional colors.
assert(colorsMatch(['W','U','R'],['W','U'],'and'));
assert(!colorsMatch(['W'],['W','U'],'and'));
assert(colorsMatch([],['C'],'and'));
assert(!colorsMatch(['U'],['C','U'],'and'));
for(const selection of [[],['U'],['U','G'],['C','U'],['A'],['A','U'],['A','C']]){
 const expected=cards.filter(c=>selection.every(s=>s==='A'?artifact(c):s==='C'?!c.colors.length:c.colors.includes(s))).map(c=>c.id);
 assert.deepEqual(cards.filter(c=>cardMatches(c,{...filters,colors:selection,colorMode:'and'})).map(c=>c.id),expected);
}
console.log('AND colors: all chosen colors, additional colors, colorless and artifact intersection OK');

// Both search fields use Japanese rules text, and English queries still work.
const siegeGang = cards.find(c => c.name === 'Siege-Gang Commander');
assert(cardMatches(siegeGang, {...filters, oracle:'トークン3体を生成する'}));
assert(cardMatches(siegeGang, {...filters, keyword:'トークン３体を生成する'}));
assert(cardMatches(siegeGang, {...filters, oracle:'create three'}));
const hammer = cards.find(c => c.name === 'Hammer of Bogardan');
assert(cardMatches(hammer, {...filters, oracle:'アップキープの間にのみ起動できる'}));
const auction = cards.find(c => c.name === "Thieves' Auction");
assert(cardMatches(auction, {...filters, oracle:'トークンでないすべてのパーマネントを追放'}));
assert.equal(cards.filter(c => c.oracle.trim()).length, 983);
assert(cards.every(c => Boolean(c.oracle.trim()) === Boolean(c.oracleJaIndex)));
assert(cardMatches(prepare({name:'Legacy', ja:'', type:'Instant', oracle:'Draw a card.'}), {...filters, oracle:'draw'}));
console.log('Japanese rules text: bilingual search, supplemental text, and full coverage OK');
