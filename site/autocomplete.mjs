const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().trim();
export function filterSuggestions(options,query,limit=60){
 const seen=new Set(),q=normalize(query),result=[];
 for(const option of options){if(!option.value||seen.has(option.value)||!normalize(option.value+' '+option.label).includes(q))continue;seen.add(option.value);result.push(option);if(result.length>=limit)break;}
 return result;
}
export function attachAutocomplete(input){
 const source=document.getElementById(input.getAttribute('list'));if(!source)return;
 const label=input.labels?.[0]?.textContent.trim()||input.id;
 input.removeAttribute('list');input.setAttribute('autocomplete','off');input.setAttribute('aria-label',label);input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded','false');
 const wrapper=document.createElement('div');wrapper.className='input-autocomplete';input.before(wrapper);wrapper.append(input);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='autocomplete-toggle';toggle.setAttribute('aria-label',label+'の候補を表示');toggle.textContent='▾';wrapper.append(toggle);
 const list=document.createElement('div');list.id=input.id+'-options';list.className='autocomplete-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label+'の候補');list.hidden=true;wrapper.append(list);input.setAttribute('aria-controls',list.id);
 let matches=[],active=-1,composing=false;
 const close=()=>{list.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 const update=()=>{
  matches=filterSuggestions([...source.options].map(o=>({value:o.value,label:o.label===o.value?'':o.label})),input.value);active=-1;list.replaceChildren();input.removeAttribute('aria-activedescendant');
  matches.forEach((m,i)=>{const option=document.createElement('div');option.id=list.id+'-'+i;option.dataset.index=i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=m.value+(m.label?' / '+m.label:'');list.append(option);});
  list.hidden=!matches.length;input.setAttribute('aria-expanded',String(!list.hidden));
 };
 const select=index=>{if(!matches[index])return;input.value=matches[index].value;input.dispatchEvent(new Event('input',{bubbles:true}));close();input.focus({preventScroll:true});};
 input.addEventListener('input',()=>{if(!composing)update();});
 input.addEventListener('compositionstart',()=>{composing=true;close();});input.addEventListener('compositionend',()=>{composing=false;update();});
 input.addEventListener('focus',()=>{if(input.value.trim())update();});
 toggle.addEventListener('pointerdown',e=>e.preventDefault());toggle.onclick=()=>{const wasOpen=!list.hidden;input.focus({preventScroll:true});if(wasOpen)close();else update();};
 input.addEventListener('keydown',e=>{
  if(composing||e.isComposing)return;
  if(e.key==='Escape'&&!list.hidden){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.key==='Tab'){close();return;}
  if(['ArrowDown','ArrowUp'].includes(e.key)){
   e.preventDefault();e.stopImmediatePropagation();if(list.hidden)update();if(!matches.length)return;
   active=(active+(e.key==='ArrowDown'?1:active<0?0:-1)+matches.length)%matches.length;
   [...list.children].forEach((o,i)=>o.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});
  }else if(e.key==='Enter'&&!list.hidden&&active>=0){e.preventDefault();e.stopImmediatePropagation();select(active);}
 },true);
 list.addEventListener('pointerdown',e=>{const option=e.target.closest('[role="option"]');if(option&&list.contains(option)){e.preventDefault();select(Number(option.dataset.index));}});
 wrapper.addEventListener('focusout',e=>{if(!wrapper.contains(e.relatedTarget))close();});
 document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))close();});
}
