import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../tools/atlantis-editor.html',import.meta.url);
const source=readFileSync(new URL('../site/publishing.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n').split('export function renderTournamentResults')[0].replaceAll('export function ','function ');
const html=readFileSync(path,'utf8').replaceAll('\r\n','\n'),start='/* SHARED_VALIDATION_START */',end='/* SHARED_VALIDATION_END */';
if(!html.includes(start)||!html.includes(end))throw Error('Editor validation markers missing');
const generated=html.slice(0,html.indexOf(start))+start+'\n'+source+end+html.slice(html.indexOf(end)+end.length);
if(process.argv.includes('--check')){if(html!==generated)throw Error('Run node scripts/build-editor.mjs before committing the offline editor');console.log('Offline editor embeds current publishing validator');}
else{writeFileSync(path,generated);console.log('Built single-file offline editor');}
