import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmedDeckDate,validatePublishingData,renderTournamentResults,renderPublishedDeckResults} from './site/publishing.mjs';
const load=x=>JSON.parse(readFileSync(new URL('./site/data/'+x+'.json',import.meta.url),'utf8'));
const live={cards:load('cards').cards,events:load('events'),results:load('results'),decks:load('decks')};
assert.deepEqual(validatePublishingData(live),[]);
const deck={...structuredClone(live.decks[0]),id:'fixture-deck',name:'<script>bad</script>',author:'Player',event:'Fixture tournament',venue:'Fixture venue'};
const event={id:'fixture-event',title:deck.event,venue:deck.venue,format:'Old Frame Modern',start:'2026-10-25T10:00:00+09:00',end:'2026-10-25T16:00:00+09:00',sample:false,entryUrl:'https://example.com/register'};
const result={id:'fixture-result',eventId:event.id,title:deck.event,date:'2026-10-25',venue:deck.venue,source:'Fixture only',players:8,topCut:1,standings:[{rank:1,player:deck.author,wins:5,losses:1,draws:0,deckId:deck.id},{rank:2,player:'Second',wins:4,losses:1,draws:1,deckId:''}]};
const valid={cards:live.cards,events:[event],decks:[deck],results:[result]};
assert.deepEqual(validatePublishingData(valid),[]);
for(const mutate of [
 d=>d.events[0].entryUrl='javascript:alert(1)',d=>d.events[0].entryUrl='https://user:password@example.com',
 d=>d.events[0].start='2026-02-30T10:00:00+09:00',d=>d.events[0].end=d.events[0].start,
 d=>d.results[0].date='2026-02-30',d=>d.results[0].standings[0].wins=-1,
 d=>d.results[0].standings[0].rank=2,d=>d.results[0].standings[0].deckId='unknown',
 d=>d.results[0].eventId='unknown',d=>d.events[0].sample=true,
 d=>d.results[0].standings[1].player='Player',d=>d.results[0].standings[0].player='Wrong author',
 d=>d.decks[0].englishText='wrong',d=>d.decks[0].main[0].qty=0,
 d=>d.results[0].standings=[null],d=>d.events=[null],d=>d.decks[0].main=[null],
 d=>d.results[0].standings.push({...d.results[0].standings[0],player:'Duplicate',deckId:deck.id})
]){const changed=structuredClone(valid);mutate(changed);assert(validatePublishingData(changed).length);}
const html=renderTournamentResults(valid.results,valid.decks);
assert(html.includes('5勝1敗'));assert(html.includes('4勝1敗1分'));assert(html.includes('data-deck="fixture-deck"'));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
assert.equal(renderTournamentResults([],[]),'');assert.equal(renderTournamentResults([{...result,sample:true}],valid.decks),'');
const privateDeck=structuredClone(result);privateDeck.standings[1].deckId=deck.id;
assert.equal((renderTournamentResults([privateDeck],valid.decks).match(/data-deck=/g)||[]).length,1);
assert(renderPublishedDeckResults(valid.decks).includes('&lt;script&gt;'));
assert(renderPublishedDeckResults(valid.decks,valid.results).includes('data-deck="fixture-deck"'));
console.log('Publishing: live data, valid results, invalid/unsafe data, top-cut links, escaping and empty state OK');

assert.equal(confirmedDeckDate({recordedAt:'2026-09-19T00:00:00',updated:'2026-09-19T00:00:00'}),'');
for(const heldOn of [undefined,null,'','2026-02-30','2026-9-1','<script>'])assert.equal(confirmedDeckDate({heldOn}),'');
for(const heldOn of ['2026-09-19','2024-02-29']){
 const candidate=structuredClone(valid);candidate.decks[0].heldOn=heldOn;
 assert.deepEqual(validatePublishingData(candidate),[]);assert.equal(confirmedDeckDate(candidate.decks[0]),heldOn);
}
const invalidDate=structuredClone(valid);invalidDate.decks[0].heldOn='2026-02-30';assert(validatePublishingData(invalidDate).some(x=>x.includes('開催日')));
console.log('Confirmed tournament dates: separate from recorded timestamps, valid dates only, blank/unconfirmed hidden OK');

const recent=renderPublishedDeckResults(Array.from({length:8},(_,i)=>({...deck,id:'recent-'+i,order:7-i})));assert.equal((recent.match(/data-deck=/g)||[]).length,5);assert(recent.indexOf('recent-7')<recent.indexOf('recent-6'));assert(!recent.includes('recent-0'));assert(recent.includes('直近の入賞リスト'));
