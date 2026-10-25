import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validatePublishingData} from '../site/publishing.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const kinds=['events','results','decks'];
export function updatePublishing({root=ROOT,files={},apply=false,restore}={}){
 const dataDir=join(root,'site','data'),old=Object.fromEntries(kinds.map(k=>[k,readFileSync(join(dataDir,k+'.json'),'utf8')]));
 if(restore){const backup=resolve(restore),allowed=resolve(root,'.publishing-backups')+sep;if(!backup.startsWith(allowed))throw Error('Restore must use a backup inside .publishing-backups');files=Object.fromEntries(kinds.map(k=>[k,join(backup,k+'.json')]))}
 const next=Object.fromEntries(kinds.map(k=>[k,files[k]?readFileSync(resolve(files[k]),'utf8'):old[k]]));
 const data=Object.fromEntries(kinds.map(k=>[k,JSON.parse(next[k])]));
 data.cards=JSON.parse(readFileSync(join(dataDir,'cards.json'),'utf8')).cards;
 const errors=validatePublishingData(data);if(errors.length)throw Error(errors.join('\n'));
 const changed=kinds.filter(k=>JSON.stringify(JSON.parse(old[k]))!==JSON.stringify(data[k]));
 const summary=changed.map(k=>({file:k+'.json',before:JSON.parse(old[k]).length,after:data[k].length}));
 if(!apply||!changed.length)return {applied:false,summary};
 // Check the baseline again before writing; preserve all original files for rollback.
 if(kinds.some(k=>readFileSync(join(dataDir,k+'.json'),'utf8')!==old[k]))throw Error('Publishing data changed during validation; retry against the latest files');
 const backup=join(root,'.publishing-backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+Math.random().toString(36).slice(2,8));mkdirSync(backup,{recursive:true});
 for(const k of kinds)writeFileSync(join(backup,k+'.json'),old[k]);
 try{
  for(const k of changed)writeFileSync(join(dataDir,k+'.tmp'),next[k]);
  for(const k of changed)renameSync(join(dataDir,k+'.tmp'),join(dataDir,k+'.json'));
 }catch(error){for(const k of kinds)writeFileSync(join(dataDir,k+'.json'),old[k]);throw error;}
 return {applied:true,backup,summary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const options={files:{},apply:false};const args=process.argv.slice(2);
  if(!args.length)throw Error('Usage: node scripts/update-publishing.mjs --events FILE --results FILE --decks FILE [--apply] OR --restore BACKUP [--apply]');
  for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--apply'){options.apply=true;continue;}if(![...kinds.map(k=>'--'+k),'--restore'].includes(arg)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid argument: '+arg);const value=args[++i];if(!existsSync(value))throw Error('File not found: '+value);if(arg==='--restore')options.restore=value;else options.files[arg.slice(2)]=value;}
  console.log(JSON.stringify(updatePublishing(options),null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
