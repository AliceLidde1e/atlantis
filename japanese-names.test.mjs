import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyJapaneseNameCorrection,japaneseNameCorrections} from './site/japanese-names.mjs';
import {prepare,cardMatches} from './site/core.mjs';
const data=JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url),'utf8'));
for(const [id,expected] of Object.entries(japaneseNameCorrections)){
 const stored=data.cards.find(c=>c.id===id);
 assert.equal(stored.ja,expected.ja);assert.equal(stored.japaneseNameSource,expected.source);
 const refreshed={...stored,ja:'再取得された誤名',japaneseNameMethod:'Scryfall printed_name/card_faces'};
 const prepared=prepare(refreshed);
 assert.equal(prepared.ja,expected.ja);
 const filters={name:expected.ja,oracle:'',keyword:'',colors:[],colorMode:'includes',type:'',min:'',max:''};
 assert(cardMatches(prepared,filters));assert(!prepared.nameIndex.includes('再取得された誤名'));
 assert.equal(applyJapaneseNameCorrection({id,oracleId:id,en:expected.name,ja:'誤名'}).ja,expected.ja);
 assert.deepEqual(applyJapaneseNameCorrection(applyJapaneseNameCorrection(refreshed)),applyJapaneseNameCorrection(refreshed));
 assert.throws(()=>applyJapaneseNameCorrection({...stored,name:'Another card'}),/mismatch/);
}
const other={id:'unrelated',name:'Other',ja:'元の名前'};assert.equal(applyJapaneseNameCorrection(other),other);
assert.equal(data.meta.japaneseNameCorrections,2);
console.log('Japanese names: official sources, refreshed wrong names, search, MO records, ID mismatch and idempotence OK');
