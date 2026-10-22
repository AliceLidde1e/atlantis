import {validateLocalState} from './core.mjs';

const STORAGE = 'atlantis.functional.mydecks.v1';

export function buildSiteDeck(source, catalog, id, updated) {
  if (!source || typeof source.name !== 'string' || !source.name.trim() || !source.cards || typeof source.cards !== 'object') {
    throw new Error('コピー元のデッキを読み取れません。');
  }
  const main = [], side = [];
  let total = 0;
  for (const [oracleId, qty] of Object.entries(source.cards)) {
    const card = catalog.get(oracleId);
    if (!card?.name) throw new Error('カードプールにないカードが含まれます。');
    for (const [zone, rows] of [['main', main], ['side', side]]) {
      const count = qty?.[zone] ?? 0;
      if (!Number.isSafeInteger(count) || count < 0 || count > 250) throw new Error('カード枚数が不正です。');
      if (count) rows.push(`${count} ${card.name}`);
      total += count;
    }
  }
  if (!total || total > 1000) throw new Error('デッキの合計枚数を確認してください。');
  const text = [...main, ...(side.length ? ['Sideboard', ...side] : [])].join('\n');
  return {id, name: source.name.trim(), text, note: source.creator ? `作成者: ${source.creator}` : '', updated};
}

export async function copyToSiteMyDecks(source) {
  const response = await fetch('data/cards.json', {cache:'no-store'});
  if (!response.ok) throw new Error('カードプールを読み込めません。');
  const data = await response.json();
  const catalog = new Map(data.cards.map(card => [card.id, card]));
  const deck = buildSiteDeck(source, catalog, crypto.randomUUID(), new Date().toISOString());
  const baseline = localStorage.getItem(STORAGE);
  const current = validateLocalState(baseline ? JSON.parse(baseline) : {version:2, decks:[], trash:[]});
  const next = validateLocalState({...current, decks:[deck, ...current.decks]});
  if (localStorage.getItem(STORAGE) !== baseline) throw new Error('別のタブでマイデッキが更新されました。もう一度お試しください。');
  localStorage.setItem(STORAGE, JSON.stringify(next));
  return deck;
}
