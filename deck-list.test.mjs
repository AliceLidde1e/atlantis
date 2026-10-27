import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupDeckLines} from './site/core.mjs';
const cards=new Map(JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url))).cards.map(c=>[c.id,c]));
const decks=JSON.parse(readFileSync(new URL('./site/data/decks.json',import.meta.url)));
for(const deck of decks)for(const zone of ['main','side']){
 const before=structuredClone(deck[zone]),groups=groupDeckLines(deck[zone],cards);
 assert.deepEqual(groups.map(g=>g.key),['spells','lands']);
 assert.equal(groups.reduce((n,g)=>n+g.total,0),before.reduce((n,l)=>n+l.qty,0));
 assert.deepEqual(groups.flatMap(g=>g.lines).map(l=>l.id).sort(),before.map(l=>l.id).sort());
 for(const [i,group] of groups.entries()){
  const expected=before.filter(l=>/\bLand\b/.test(cards.get(l.id).type.split(' — ')[0])===!!i);
  assert.deepEqual(group.lines,expected);
 }
 assert.deepEqual(deck[zone],before);
}
const fixtures=new Map([['s',{type:'Creature — Spirit'}],['l',{type:'Basic Land — Island'}],['lc',{type:'Land Creature — Forest Dryad'}],['a',{type:'Artifact Land'}]]);
const rows=[{id:'l',qty:2},{id:'s',qty:4},{id:'lc',qty:1},{id:'a',qty:1}];
assert.deepEqual(groupDeckLines(rows,fixtures).map(g=>g.lines.map(l=>l.id)),[['s'],['l','lc','a']]);
assert.deepEqual(groupDeckLines([],fixtures).map(g=>g.total),[0,0]);
assert.throws(()=>groupDeckLines([{id:'missing',qty:1}],fixtures),/Unknown deck card/);
console.log('Published deck grouping: spells/lands, 48 decks, both zones, stable order and quantities OK');
