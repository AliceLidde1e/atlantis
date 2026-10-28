import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {printingOptions,printingFallbackReason,printingCaption} from './site/core.mjs';
const snapshot=JSON.parse(readFileSync(new URL('./site/data/printings.json',import.meta.url)));
const cards=JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url))).cards;
assert.equal(snapshot.meta.ruleVersion,3);
assert.equal(Object.keys(snapshot.cards).length,1015);
for(const c of cards){
 const record=snapshot.cards[c.id];
 assert(record,`Missing ${c.name}`);
 for(const lang of ['en','ja']){
  const selected=printingOptions(record,lang);
  assert(selected.choices.length,`${c.name}/${lang} has no usable candidate`);
  assert.equal(new Set(selected.choices.map(p=>p.id)).size,selected.choices.length);
  if(lang==='en'){assert.equal(selected.choices[0].regular,true,`${c.name}/${lang} normal printing`);assert(selected.choices[0].finishes.includes('nonfoil'),`${c.name}/${lang} nonfoil printing`);}else if(!selected.choices[0].regular||!selected.choices[0].finishes.includes('nonfoil'))assert(selected.reason,`${c.name}: relaxed finish must be explained`);
 }
}
for(const [name,set,number] of [['Beast of Burden','ulg','122'],['Withered Wretch','lgn','86'],['Soul Collector','scg','74']]){
 const record=snapshot.cards[cards.find(c=>c.name===name).id];
 const first=printingOptions(record,'en').choices[0];
 assert.equal(first.set,set);assert.equal(first.number,number);assert.equal(first.promo,false);
 assert.equal(printingOptions(record,'en').reason,'');
}
const normal={id:'normal',lang:'en',set:'abc',number:'1',image:'https://example.test/a.jpg',regular:true,promo:false,finishes:['nonfoil','foil']};
const foil={...normal,id:'foil',regular:false,promo:true,finishes:['foil']};
const ja={...normal,id:'ja',lang:'ja'};
let record={en:{target:normal,candidates:[normal,foil]},ja:{target:ja,candidates:[ja]}};
assert.equal(printingOptions(record,'en').choices[0].id,'normal');
assert.equal(printingOptions(record,'en').reason,'');
record={en:{target:{...normal,image:''},candidates:[foil]},ja:{target:ja,candidates:[ja]}};
assert.equal(printingOptions(record,'en').choices[0].id,'foil');
assert.match(printingOptions(record,'en').reason,/プロモ版.*FOIL版.*指定版の画像なし/);
record={en:{target:null,candidates:[]},ja:{target:ja,candidates:[ja]}};
assert.equal(printingOptions(record,'en').choices[0].id,'ja');
assert.match(printingOptions(record,'en').reason,/日本語版.*英語版なし/);
record={en:{target:foil,candidates:[foil]}};
assert.equal(printingOptions(record,'en').choices[0].image,foil.image);
assert.match(printingOptions(record,'en').reason,/通常・非FOIL版なし/);
assert.match(printingFallbackReason(record,'en',foil,{imageFailed:true}),/画像取得失敗/);
assert.equal(printingCaption(ja),'JA ABC #1');
console.log('Printing selection: all 1,015 cards/languages, known promos, missing images, foil-only and cross-language fallbacks OK');

for(const [name,set] of [['Lightning Bolt','m10'],['Counterspell','mh2']]){const r=snapshot.cards[cards.find(c=>c.name===name).id];assert.equal(r.ja.targetSet,set);assert.equal(printingOptions(r,'ja').choices[0].set,set);}
