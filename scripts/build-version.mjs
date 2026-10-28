import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const value={count:Number(git('rev-list','--count','HEAD')),revision:git('rev-parse','--short=7','HEAD'),date:git('show','-s','--format=%cs','HEAD')};
if(!Number.isSafeInteger(value.count)||!/^[a-f0-9]{7,40}$/.test(value.revision))throw Error('Cannot determine repository version');
writeFileSync(new URL('../site/version.json',import.meta.url),JSON.stringify(value)+'\n');
console.log(`Repository version: rev.${value.count} · ${value.revision}`);
