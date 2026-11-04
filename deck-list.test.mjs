import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupDeckLines} from './site/core.mjs';
const cards=new Map(JSON.parse(readFileSync(new URL('./site/data/cards.json',import.meta.url))).cards.map(c=>[c.id,c]));
const decks=JSON.parse(readFileSync(new URL('./site/data/decks.json',import.meta.url)));
for(const deck of decks)for(const zone of ['main','side']){
 const before=structuredClone(deck[zone]),groups=groupDeckLines(deck[zone],cards);
 assert.deepEqual(groups.map(g=>g.key),['creatures','spells','lands']);
 assert.equal(groups.reduce((n,g)=>n+g.total,0),before.reduce((n,l)=>n+l.qty,0));
 assert.deepEqual(groups.flatMap(g=>g.lines).map(l=>l.id).sort(),[...new Set(before.map(l=>l.id))].sort());
 for(const line of groups.flatMap(g=>g.lines))assert.equal(line.qty,before.filter(l=>l.id===line.id).reduce((n,l)=>n+l.qty,0));
 assert.deepEqual(deck[zone],before);
}
const fixtures=new Map([['c',{type:'Artifact Creature — Spirit'}],['s',{type:'Instant'}],['l',{type:'Basic Land — Island'}],['lc',{type:'Land Creature — Forest Dryad'}],['a',{type:'Artifact Land'}],['sub',{type:'Enchantment — Creature Land'}]]);
const rows=[{id:'l',qty:2},{id:'c',qty:4},{id:'s',qty:2},{id:'lc',qty:1},{id:'a',qty:1},{id:'c',qty:1},{id:'sub',qty:3}];
const before=structuredClone(rows);
assert.deepEqual(groupDeckLines(rows,fixtures).map(g=>g.lines.map(l=>l.id)),[['c'],['s','sub'],['l','lc','a']]);
assert.deepEqual(groupDeckLines(rows,fixtures).map(g=>g.total),[5,5,4]);
assert.deepEqual(rows,before);
assert.deepEqual(groupDeckLines([],fixtures).map(g=>g.total),[0,0,0]);
assert.throws(()=>groupDeckLines([{id:'missing',qty:1}],fixtures),/Unknown deck card/);
console.log('Deck grouping: creatures/spells/lands, duplicate counts, land precedence, stable order and source preservation OK');
