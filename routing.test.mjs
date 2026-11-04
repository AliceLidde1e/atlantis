import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the production routing/search recovery functions with a small DOM
// fixture. No browser or card-image network requests are needed.
const app=readFileSync(process.argv[2]||new URL('./site/app.mjs',import.meta.url),'utf8');
const functions=app.slice(app.indexOf('function saveSearch(){'),app.indexOf('function chip('));
function fixture(hash='#home',savedView='decks'){
 const values=new Map([['atlantis.functional.search.v1',JSON.stringify({
  currentView:savedView,values:{'deck-query':'Angel'},selectedCards:[],cardPage:2,
  colors:{card:[],deck:[]},display:'list'
 })]]);
 const input=(id,value='')=>({id,value,type:'text',setAttribute(){},removeAttribute(){}});
 const inputs=[input('deck-query'),input('card-display','grid')];
 const views=['home','decks','cards','events','my','guide','about'].map(view=>({id:'view-'+view,hidden:view!=='home'}));
 const menu={open:false,close(){this.open=false;}};
 const detail={open:false,close(){this.open=false;},addEventListener(){}};
 const handlers=new Map();
 const links=['home','decks','pool','events','mydecks'].map(view=>({
  attrs:{href:'#'+view},getAttribute(name){return this.attrs[name];},
  setAttribute(name,value){this.attrs[name]=value;},removeAttribute(name){delete this.attrs[name];}
 }));
 const location={hash};
 const history={entries:[],pushState(state,title,hash){this.entries.push(hash);location.hash=hash;},replaceState(state,title,hash){location.hash=hash;}};
 const context=vm.createContext({location,history,
  sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
  window:{addEventListener:(name,handler)=>handlers.set(name,handler)},document:{addEventListener(){}},
  closeDetail(){detail.close();},renderDetailState(){},detailOpener:null,
  $:selector=>selector==='#detail'?detail:selector==='#menu-dialog'?menu:inputs.find(x=>'#'+x.id===selector),
  $$:selector=>selector==='.view'?views:selector==='nav a[href^="#"]'?links:selector==='input[id],select[id]'?inputs:[],
  selectedColors:()=>[],syncManaSliders(){},syncWorkbenchLayout(){},renderMy(){},renderEvents(){},renderResults(){},
  field:id=>inputs.find(x=>x.id===id)?.value
 });
 vm.runInContext("const SESSION='atlantis.functional.search.v1';let currentView='home',searchReady=false,selectedCards=[],cardPage=1;const cardMap=new Map();"+functions,context);
 vm.runInContext(app.slice(app.indexOf("$('#detail').addEventListener('cancel'"),app.indexOf("$('#test-error')")),context);
 return {handlers,detail,run:code=>vm.runInContext(code,context),context,location,history,values,views,links,menu,inputs};
}
function assertView(f,view,hash){
 assert.equal(f.run('currentView'),view);
 assert.deepEqual(f.views.filter(x=>!x.hidden).map(x=>x.id),['view-'+view]);
 assert.equal(f.location.hash,hash);
}
function click(f,hash,extra={}){
 const link={target:'',hasAttribute:()=>false,getAttribute:()=>hash};
 const event={button:0,defaultPrevented:false,target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;},...extra};
 f.context.event=event;
 f.run('handleRouteClick(event)');
 return event;
}

// A previous Decks search must not change the route during asynchronous loading.
for(const saved of ['decks','cards','my','home']){
 const f=fixture('#home',saved);
 f.run("navigate('home');restoreSearch();");
 assertView(f,'home','#home');
 assert.equal(f.inputs[0].value,'Angel');
 assert.equal(f.inputs[1].value,'list');
 assert.equal(f.run('cardPage'),2);
 f.run('searchReady=true;saveSearch()');
 assert(!Object.hasOwn(JSON.parse(f.values.get('atlantis.functional.search.v1')),'currentView'));
}

for(const [hash,view,canonical] of [
 ['','home','#home'],['#home','home','#home'],['#decks','decks','#decks'],
 ['#pool','cards','#pool'],['#cards','cards','#pool'],['#events','events','#events'],
 ['#mydecks','my','#mydecks'],['#my','my','#mydecks'],['#guide','guide','#guide'],['#about','about','#about']
]){
 const f=fixture(hash);
 f.run('navigateFromLocation();restoreSearch();navigateFromLocation();');
 assertView(f,view,canonical);
}

// Home applies immediately, including from a mobile menu and an unchanged hash.
const f=fixture('#decks');
f.run('navigateFromLocation()');f.menu.open=true;
assert(click(f,'#home').defaultPrevented);
assertView(f,'home','#home');assert.equal(f.menu.open,false);
assert.deepEqual(f.history.entries,['#home']);
f.run("currentView='decks'");f.menu.open=true;
assert(click(f,'#home').defaultPrevented);
assertView(f,'home','#home');assert.equal(f.menu.open,false);
assert.deepEqual(f.history.entries,['#home']);
f.run('restoreSearch();navigateFromLocation()');assertView(f,'home','#home');

// A later navigation during loading wins, and restoring a tab follows its URL.
click(f,'#pool');f.run('restoreSearch();navigateFromLocation()');assertView(f,'cards','#pool');
f.location.hash='#home';f.handlers.get('pageshow')();assertView(f,'home','#home');
f.location.hash='#decks';f.handlers.get('popstate')({state:null});assertView(f,'decks','#decks');
f.location.hash='#home';f.menu.open=true;f.handlers.get('hashchange')();assertView(f,'home','#home');assert.equal(f.menu.open,false);
f.detail.open=true;f.handlers.get('popstate')({state:null});assert.equal(f.detail.open,false);assertView(f,'home','#home');
for(const extra of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}]){
 const before=f.history.entries.length;click(f,'#decks',extra);
 assertView(f,'home','#home');assert.equal(f.history.entries.length,before);
}
assert(!click(f,'#main').defaultPrevented);assertView(f,'home','#home');
assert(!click(f,'#unknown').defaultPrevented);assertView(f,'home','#home');
for(const fragment of ['toString','constructor','__proto__'])assert.equal(f.run(`routeView('${fragment}')`),null);

console.log('Routing: Home URL priority, legacy search recovery, immediate links, menu, aliases, history restoration and native anchors OK');
