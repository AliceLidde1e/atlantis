import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {applyJapaneseNameCorrection,japaneseNameCorrections} from '../site/japanese-names.mjs';
const path=new URL('../site/data/cards.json',import.meta.url),data=JSON.parse(readFileSync(path,'utf8'));
for(const [id,correction] of Object.entries(japaneseNameCorrections)){
 if(!data.cards.some(c=>c.id===id&&c.name===correction.name))throw Error('Correction target absent: '+id);
}
data.cards=data.cards.map(applyJapaneseNameCorrection);
data.meta.japaneseNameCorrections=data.cards.filter(c=>c.japaneseNameMethod==='official correction').length;
data.meta.japaneseNamesFromScryfall=data.cards.filter(c=>c.ja&&c.japaneseNameMethod?.startsWith('Scryfall')).length;
data.meta.japaneseNameMethod='Scryfallの取得結果に欠落補完を適用後、Oracle ID別の公式資料に基づく名称補正を最優先で適用。';
const tmp=new URL('../site/data/cards.tmp',import.meta.url);
writeFileSync(tmp,JSON.stringify(data));renameSync(tmp,path);
console.log(`Japanese names: ${data.meta.japaneseNameCorrections} official corrections applied`);
