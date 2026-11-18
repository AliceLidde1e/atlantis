import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./site/app.mjs',import.meta.url),'utf8');
const start=source.indexOf('/* Shared page tools:');
const end=source.indexOf('/* End shared page tools. */',start);
assert(start>=0&&end>start);
const element=()=>({hidden:false,open:false,textContent:'',title:'',attributes:{},style:{values:{},setProperty(name,value){this.values[name]=value;}},setAttribute(name,value){this.attributes[name]=value;},getBoundingClientRect(){return this.bounds||{top:150,right:1180};}});
const elements=Object.fromEntries(['#draft-dock','#draft-resume','#scroll-top','#pool-toggle','#builder','#toast','.mobile-nav'].map(key=>[key,element()]));
elements['#toast'].hidden=true;
elements['.mobile-nav'].display='none';
const frames=[],calls=[];
const state={
 draftActive:false,currentView:'home',mobileWorkbench:{matches:false},pageToolsFrame:null,modal:null,reducedMotion:false,
 $:selector=>selector==='dialog:modal'?state.modal:elements[selector],
 field:()=>state.deckName,
 deckName:'編集中のデッキ',
 window:{scrollY:0,innerWidth:1200,innerHeight:900,scrollTo:value=>calls.push(['scroll',value.top,value.behavior])},
 getComputedStyle:el=>({display:el.display}),
 requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
 matchMedia:()=>({matches:state.reducedMotion}),
 navigate:view=>{calls.push(['navigate',view]);state.currentView=view;},
 openPool:()=>{calls.push(['open']);elements['#builder'].open=true;},
 closePool:()=>{calls.push(['close']);elements['#builder'].open=false;},
};
const context=vm.createContext(state);
vm.runInContext(source.slice(start,end),context);
const run=code=>vm.runInContext(code,context);
run('syncPageTools()');
assert(elements['#draft-dock'].hidden&&elements['#draft-resume'].hidden&&elements['#scroll-top'].hidden);
assert.equal(elements['#pool-toggle'].hidden,false,'Start a Deck remains available without a draft');

state.draftActive=true;
run('syncPageTools()');
assert.equal(elements['#draft-resume'].hidden,false);
assert.equal(elements['#pool-toggle'].hidden,true,'Only one active editor entry is shown');
assert(elements['#draft-resume'].textContent.includes(state.deckName));
assert.equal(elements['#draft-resume'].style.values['--draft-top'],'150px','Initial slot keeps editor entry below the header');

state.window.scrollY=700;
elements['#draft-dock'].bounds={top:-550,right:1180};
run('syncPageTools()');
assert.equal(elements['#draft-resume'].style.values['--draft-top'],'12px','Editor entry follows the viewport after scrolling');
assert.equal(elements['#scroll-top'].hidden,false);
run('resumeWorkbench()');
assert.deepEqual(calls.splice(0),[['navigate','cards'],['open']],'Resume returns to Cards and opens the existing draft');
run('resumeWorkbench()');
assert.deepEqual(calls.splice(0),[['close']],'Wide editor can be stowed from the same entry');
assert.equal(state.draftActive,true,'Stowing does not end the draft');

state.modal={id:'detail'};
run('syncPageTools(); scrollPageToTop()');
assert(elements['#draft-resume'].hidden&&elements['#scroll-top'].hidden,'No page tools appear above a modal');
assert.equal(calls.length,0,'Top never scrolls the page behind a modal');
state.modal=null;
state.currentView='my';
state.mobileWorkbench.matches=true;
state.window.innerWidth=390;
state.window.innerHeight=844;
elements['.mobile-nav'].display='grid';
elements['.mobile-nav'].bounds={top:772};
elements['#draft-dock'].bounds={top:100,right:378};
run('syncPageTools()');
assert.equal(elements['#draft-resume'].textContent,'Deck Editor');
assert.equal(elements['#scroll-top'].style.values['--top-bottom'],'84px','Top clears the mobile navigation');
elements['#toast'].hidden=false;
elements['#toast'].bounds={top:660};
run('syncPageTools()');
assert.equal(elements['#scroll-top'].style.values['--top-bottom'],'196px','Top also clears visible notifications');
run('scrollPageToTop()');
state.reducedMotion=true;
run('scrollPageToTop()');
assert.deepEqual(calls.splice(0),[['scroll',0,'smooth'],['scroll',0,'instant']]);

state.draftActive=false;
run('syncPageTools(); resumeWorkbench()');
assert(elements['#draft-resume'].hidden&&elements['#draft-dock'].hidden,'Finished or discarded drafts remove the editor entry');
assert.equal(calls.length,0,'Resume never starts a new draft');
run('schedulePageTools(); schedulePageTools()');
assert.equal(frames.length,1,'Scroll/resize updates are coalesced');
frames.shift()();
assert.equal(state.pageToolsFrame,null);

const html=readFileSync(new URL('./site/index.html',import.meta.url),'utf8');
const actions=html.match(/<div class="my-deck-actions"[^>]*>(.*?)<\/div>/s)[1];
assert(actions.indexOf('id="new-deck"')<actions.indexOf('id="backup"'));
assert(actions.indexOf('id="backup"')<actions.indexOf('id="restore-file"'));
assert.equal((html.match(/id="new-deck"/g)||[]).length,1);
assert(html.indexOf('id="scroll-top"')>html.indexOf('</main>'));
assert(html.indexOf('id="scroll-top"')<html.indexOf('<dialog id="builder"'));
assert(html.includes('<details id="workbench-options" hidden><summary>Deck Options</summary>'),'Options retain their native keyboard-accessible disclosure');
console.log('Page tools: draft resume/stow, modal exclusion, scrolling, mobile navigation/toast spacing, reduced motion and action order OK');
