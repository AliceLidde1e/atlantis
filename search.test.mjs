import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepare,cardMatches,deckMatches,colorsMatch,validateLocalState,createBackup} from './site/core.mjs';
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
