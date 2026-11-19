import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./site/app.mjs',import.meta.url),'utf8');
class Node {
 constructor(name){this.name=name;this.children=[];this.parent=null;this.hidden=false;this.open=false;this.handlers={};}
 detach(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
 append(...nodes){for(const node of nodes){node.detach();node.parent=this;this.children.push(node);}}
 prepend(node){node.detach();node.parent=this;this.children.unshift(node);}
 replaceChildren(...nodes){for(const node of [...this.children])node.detach();this.append(...nodes);}
 querySelector(name){for(const child of this.children){if(child.name===name)return child;const nested=child.querySelector(name);if(nested)return nested;}return null;}
}
const dialog=new Node('#detail'),toolbar=new Node('.dialog-toolbar');
const header=new Node('#detail-deck-header'),body=new Node('#detail-body');
toolbar.handlers.click=()=>{};
dialog.append(toolbar,header,body);
const information=new Map();
const state={
 activeDetailKey:'published-1',detailInformation:information,
 $:selector=>selector==='#detail'?dialog:selector==='#detail-deck-header'?header:selector==='#detail-body .deck-detail-overview'?body.querySelector('.deck-detail-overview'):null,
};
const context=vm.createContext(state);
const begin=source.indexOf('/* Deck detail headers share');
const end=source.indexOf('/* End deck detail header layout. */',begin);
assert(begin>=0&&end>begin);
vm.runInContext(source.slice(begin,end),context);
function overview(withInformation){
 const node=new Node('.deck-detail-overview');
 node.append(new Node('h1'),new Node('.deck-detail-controls'));
 if(withInformation)node.append(new Node('#detail-information'));
 return node;
}
let summary=overview(true);body.append(summary,new Node('.deck-board'));
vm.runInContext("layoutDetailHeader('deck')",context);
assert.deepEqual(header.children,[toolbar,summary]);
assert.equal(body.children[0].name,'.deck-board','Only card content remains below the sticky header');
assert.equal(header.hidden,false);
assert.equal(header.querySelector('#detail-information').open,false,'A fresh published deck starts collapsed');
const originalHandler=toolbar.handlers.click;

information.set('published-1',true);
summary=overview(true);body.replaceChildren(summary,new Node('.deck-board'));
vm.runInContext("layoutDetailHeader('deck')",context);
assert.equal(header.querySelector('#detail-information').open,true,'Display-mode rerenders preserve Information state');
assert.equal(toolbar.handlers.click,originalHandler,'Moving the shared toolbar preserves its handlers');
state.activeDetailKey='published-2';
body.replaceChildren(overview(true));
vm.runInContext("layoutDetailHeader('deck')",context);
assert.equal(header.querySelector('#detail-information').open,false,'Another published deck starts collapsed');

body.replaceChildren(new Node('.detail-top'));
vm.runInContext("layoutDetailHeader('card')",context);
assert.equal(header.hidden,true);
assert.equal(header.children.length,0);
assert.equal(toolbar.parent,dialog,'Card details keep their original toolbar placement');
assert.equal(toolbar.handlers.click,originalHandler);
body.replaceChildren(overview(false),new Node('.deck-board'));
vm.runInContext("layoutDetailHeader('local')",context);
assert.equal(header.hidden,false);
assert.equal(header.querySelector('#detail-information'),null,'My Decks needs no fourth row');

// Exercise actual published/local renderers, retaining their original action attributes.
const published={id:'pub',name:'WUR Angel Midrange',author:'Player',event:'Tournament',result:'1st',venue:'Venue',colors:['U'],archetype:'Midrange',main:[],side:[]};
const mine={id:'mine',name:'My Deck',text:''};
const renders=[];
Object.assign(state,{
 decks:[published],local:{decks:[mine]},
 esc:value=>String(value),
 deckDateMarkup:()=>'<p>2026-11-19</p>',confirmedDeckDate:()=> '2026-11-19',
 tags:()=>'<span>Blue</span>',deckImageButton:()=>'<button data-deck-image>Deck Image</button>',
 deckBoard:(_rows,zone,_editing,mode)=>`<section class="deck-board" data-zone="${zone}" data-mode="${mode}"></section>`,
 deckLines:()=>'',parsedLocalDeck:()=>({rows:[],unknown:[]}),
 showDetail:(html,type,id,mode)=>renders.push({html,type,id,mode}),
});
vm.runInContext(source.slice(source.indexOf("function openDeck(id,mode='visual'){"),source.indexOf('const parsedDeckCache=')),context);
vm.runInContext(source.slice(source.indexOf("function openMyDeck(id,mode='visual'){"),source.indexOf('function refreshDetail()')),context);
vm.runInContext("openDeck('pub','list');openMyDeck('mine','visual')",context);
const [pub,local]=renders;
assert.equal(pub.mode,'list');assert.equal(local.mode,'visual');
assert(pub.html.includes('data-copy="pub"')&&pub.html.includes('data-download="pub"'));
assert(local.html.includes('data-edit="mine"')&&local.html.includes('data-local-copy="mine"')&&local.html.includes('data-local-export="mine"'));
assert(local.html.includes('title="Export MO">Export</button>'),'Short Export label preserves the MO export action');
assert.equal((local.html.match(/<h1/g)||[]).length,1);
const details=pub.html.match(/<details id="detail-information"([^>]*)>(.*?)<\/details>/s);
assert(details&&!/\bopen\b/.test(details[1]));
for(const text of ['Information','Player','Tournament','Venue','1st','2026-11-19'])assert(details[2].includes(text));
assert(pub.html.indexOf('</details>')<pub.html.indexOf('<section class="deck-board"'));
assert(local.html.indexOf('data-local-export')<local.html.indexOf('<section class="deck-board"'));
assert(source.includes("$('#detail').addEventListener('click',event=>{\n if(event.target.closest('[data-deck-image]'))openDeckImage();"),'Deck Image is delegated above both the header and card body');
console.log('Detail headers: toolbar round trips, collapsed Information, display-state restoration and original deck actions OK');
