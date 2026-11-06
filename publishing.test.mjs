import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmedDeckDate,validatePublishingData,renderTournamentResults,renderPublishedDeckResults,collectEventResults,renderEventResult,renderEventSummary,eventChampions,eventRoute,publishedDeckRank,eventResultHref} from './site/publishing.mjs';
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
assert(renderEventResult(collectEventResults(valid.decks)[0]).includes('&lt;script&gt;'));
assert(renderEventResult(collectEventResults(valid.decks,valid.results)[0]).includes('data-deck="fixture-deck"'));
console.log('Publishing: live data, valid results, invalid/unsafe data, top-cut links, escaping and empty state OK');

assert.equal(confirmedDeckDate({recordedAt:'2026-09-19T00:00:00',updated:'2026-09-19T00:00:00'}),'');
for(const heldOn of [undefined,null,'','2026-02-30','2026-9-1','<script>'])assert.equal(confirmedDeckDate({heldOn}),'');
for(const heldOn of ['2026-09-19','2024-02-29']){
 const candidate=structuredClone(valid);candidate.decks[0].heldOn=heldOn;
 assert.deepEqual(validatePublishingData(candidate),[]);assert.equal(confirmedDeckDate(candidate.decks[0]),heldOn);
}
const invalidDate=structuredClone(valid);invalidDate.decks[0].heldOn='2026-02-30';assert(validatePublishingData(invalidDate).some(x=>x.includes('開催日')));
console.log('Confirmed tournament dates: separate from recorded timestamps, valid dates only, blank/unconfirmed hidden OK');


const groups=collectEventResults(live.decks,live.results);
assert.equal(groups.reduce((sum,g)=>sum+g.rows.length,0),live.decks.length);
assert(groups.length>7); // Same-name recurring tournaments stay separate by confirmed date.
assert.equal(groups.find(g=>g.title==='第三回 旧枠モダンGP群馬').rows.length,8);
assert.equal(groups.find(g=>g.title==='第三回 旧枠モダンGP群馬').date,'2026-09-22');
assert(groups.filter(g=>g.title==='定例大会').length>1);
const overview=renderPublishedDeckResults(live.decks);
assert(!overview.includes('直近の入賞リスト'));assert(overview.includes('#events/'));assert(!overview.includes('data-deck='));
assert.equal(renderPublishedDeckResults([],[]),'');
const fixture=collectEventResults(valid.decks,valid.results)[0];
assert.equal(fixture.players,8);assert.equal(fixture.rows.length,1);assert.equal(fixture.rows[0].label,'1');
assert(renderEventResult(fixture).includes('8名'));assert(renderEventResult(fixture).includes('&lt;script&gt;'));
assert(!renderEventResult(fixture).includes('<script>'));assert(!renderEventResult(fixture).includes('通算成績'));
const historical=collectEventResults(valid.decks)[0];assert.equal(historical.date,deck.heldOn);assert.equal(historical.players,null);
assert(renderEventResult(historical).includes('未確認'));assert(!renderEventResult(historical).includes('8名'));
assert.deepEqual(['優勝','準優勝','TOP4','TOP8','3位','5勝1敗'].map(publishedDeckRank),[1,2,4,8,3,Infinity]);
const rankDecks=['TOP8','準優勝','優勝','TOP4'].map((result,i)=>({...deck,id:'rank-'+i,result,heldOn:'2026-09-22'}));
assert.deepEqual(collectEventResults(rankDecks)[0].rows.map(r=>r.label),['優勝','準優勝','TOP4','TOP8']);
assert.equal(collectEventResults([...rankDecks,{...deck,id:'sample',sample:true}])[0].rows.length,4);
assert.equal(collectEventResults([{...deck,id:'a',heldOn:''},{...deck,id:'b',heldOn:''}]).length,2);
const extra={...deck,id:'extra',heldOn:result.date};
assert.equal(collectEventResults([...valid.decks,extra],valid.results).length,1);
assert.equal(collectEventResults([...valid.decks,extra],valid.results)[0].rows.length,2);
const empty=collectEventResults([],valid.results)[0];assert(renderEventResult(empty).includes('掲載デッキはまだありません'));
assert.equal(decodeURIComponent(eventResultHref('test/&<>').slice('#events/'.length)),'test/&<>');
assert.deepEqual(collectEventResults([...live.decks].reverse()).map(g=>g.id),groups.map(g=>g.id));
console.log('Event pages: all live decks, recurring events, rank labels, metadata, top-cut links, sample exclusion, escaping and empty states OK');

// The winning deck alone supplies the event image; the first/top-listed deck is not evidence.
for(const resultLabel of ['準優勝','TOP4','TOP8','TOP1','5勝1敗']){
 const group=collectEventResults([{...deck,result:resultLabel}])[0];
 assert.deepEqual(eventChampions(group),[]);
 const summary=renderEventSummary(group,()=>{throw Error('Non-winner used as an event thumbnail');});
 assert(summary.includes('優勝者未確認'));assert(summary.includes('event-placeholder'));
}
for(const resultLabel of ['優勝','1位']){
 const group=collectEventResults([{...deck,result:resultLabel}])[0];
 const summary=renderEventSummary(group,winner=>`<img data-winner="${winner.id}">`);
 assert(summary.includes('data-winner="fixture-deck"'));assert(summary.includes('&lt;script&gt;'));
 assert(!summary.includes('<script>'));assert(summary.includes(deck.venue));assert(summary.includes('未確認'));
}
const official=collectEventResults(valid.decks,valid.results)[0];
assert.equal(eventChampions(official)[0].deck.id,deck.id);
const noWinnerDeck={...result,standings:[{...result.standings[0],deckId:''}]};
const unlistedWinner=collectEventResults([], [noWinnerDeck])[0];
assert.equal(eventChampions(unlistedWinner)[0].player,deck.author);
assert.equal(eventChampions(unlistedWinner)[0].deck,null);
assert(renderEventSummary(unlistedWinner).includes('デッキ未掲載'));
assert(renderEventSummary(unlistedWinner).includes('event-placeholder'));
assert(!renderEventSummary(unlistedWinner).includes('優勝者未確認'));
const officialWithoutChampion={...result,standings:[{...result.standings[0],rank:2}],topCut:2};
assert.deepEqual(eventChampions(collectEventResults(valid.decks,[officialWithoutChampion])[0]),[]);

// The overview contains only six records; the directory includes the same six and all remaining ones.
const visible=renderPublishedDeckResults(live.decks,live.results,{limit:6});
const directory=renderPublishedDeckResults(live.decks,live.results);
assert.equal((visible.match(/class="deck-card /g)||[]).length,6);
assert.equal((directory.match(/class="deck-card /g)||[]).length,groups.length);
for(const group of groups.slice(0,6))assert(visible.includes(eventResultHref(group.id))&&directory.includes(eventResultHref(group.id)));
assert(!visible.includes('<details'));assert(!directory.includes('<details'));
assert.equal(eventRoute('events').kind,'overview');
assert.equal(eventRoute('events/results').page,'view-event-directory');
assert.equal(eventRoute('events/announcements').page,'view-event-announcements');
for(const id of ['result-fixture-result','decks-fixture-deck','test/&<>']){
 const route=eventRoute(eventResultHref(id).slice(1));
 assert.equal(route.kind,'detail');assert.equal(route.id,id);
}
assert.equal(eventRoute('events/%E0%A4%A').id,'');
assert.equal(eventRoute('decks'),null);
console.log('Event cards/directories: confirmed winners, missing winner/deck, six/full lists, route separation and escaping OK');
