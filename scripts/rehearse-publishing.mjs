import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {updatePublishing} from './update-publishing.mjs';
const root=mkdtempSync(join(tmpdir(),'atlantis-publishing-')),dataDir=join(root,'site','data');mkdirSync(dataDir,{recursive:true});
try{
 for(const kind of ['cards','events','results','decks'])writeFileSync(join(dataDir,kind+'.json'),readFileSync(new URL('../site/data/'+kind+'.json',import.meta.url)));
 const original=readFileSync(join(dataDir,'decks.json'),'utf8'),decks=JSON.parse(original),candidate=join(root,'candidate.json');
 writeFileSync(candidate,JSON.stringify(decks.slice(1)));
 const dry=updatePublishing({root,files:{decks:candidate}});assert.equal(dry.applied,false);assert.equal(readFileSync(join(dataDir,'decks.json'),'utf8'),original);
 const applied=updatePublishing({root,files:{decks:candidate},apply:true});assert(applied.applied);assert.equal(JSON.parse(readFileSync(join(dataDir,'decks.json'),'utf8')).length,decks.length-1);
 const restored=updatePublishing({root,restore:applied.backup,apply:true});assert(restored.applied);assert.equal(readFileSync(join(dataDir,'decks.json'),'utf8'),original);
 const invalid=structuredClone(decks);invalid[0].englishText='broken';writeFileSync(candidate,JSON.stringify(invalid));assert.throws(()=>updatePublishing({root,files:{decks:candidate},apply:true}));assert.equal(readFileSync(join(dataDir,'decks.json'),'utf8'),original);
 assert.throws(()=>updatePublishing({root,restore:root,apply:true}));
 console.log(`Publishing rehearsal OK: dry-run, stop ${decks.length} -> ${decks.length-1}, backup, restore to ${decks.length}, invalid-update rejection. Public files unchanged.`);
}finally{assert(root.startsWith(join(tmpdir(),'atlantis-publishing-')),'Unexpected temporary directory');rmSync(root,{recursive:true,force:true});}
