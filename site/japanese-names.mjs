// Reviewed names take precedence over API printed_name, keyed by Oracle ID.
export const japaneseNameCorrections = Object.freeze({
 '069be6a0-9545-4fdc-ad40-957fe307db7a': Object.freeze({name:'Shivan Hellkite',ja:'シヴのヘルカイト',source:'https://mtg-jp.com/products/card-gallery/0000107/',verified:'2026-10-24'}),
 'e41162bf-1a4f-4e69-870a-faf9836c56d5': Object.freeze({name:"Shiv's Embrace",ja:'シヴの抱擁',source:'https://mtg-jp.com/gameplay/rules/docs/0006833/',verified:'2026-10-24'})
});
export function applyJapaneseNameCorrection(card){
 const correction=japaneseNameCorrections[card.oracleId||card.id];
 if(!correction)return card;
 if((card.name||card.en)!==correction.name)throw Error('Japanese name correction: Oracle ID / English name mismatch');
 return {...card,ja:correction.ja,japaneseNameSource:correction.source,japaneseNameMethod:'official correction',japaneseNameVerified:correction.verified};
}
