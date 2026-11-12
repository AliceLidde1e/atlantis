const WIDTH=780, MARGIN=28, GAP=12, COLUMNS=3;
const CARD_WIDTH=(WIDTH-MARGIN*2-GAP*2)/COLUMNS;
const CARD_HEIGHT=Math.round(CARD_WIDTH*88/63);
const ROW_HEIGHT=CARD_HEIGHT+62;
const FONT='system-ui, sans-serif';

function loadImage(url,signal){
 return new Promise(resolve=>{
  if(signal.aborted){resolve(null);return;}
  const image=new Image();
  const finish=value=>{
   clearTimeout(timer);
   signal.removeEventListener('abort',cancel);
   image.onload=image.onerror=null;
   if(!value)image.removeAttribute('src');
   resolve(value);
  };
  const cancel=()=>finish(null);
  const timer=setTimeout(cancel,5000);
  signal.addEventListener('abort',cancel,{once:true});
  image.crossOrigin='anonymous';
  image.referrerPolicy='no-referrer';
  image.onload=()=>finish(image);
  image.onerror=cancel;
  image.src=url;
 });
}

async function cardImage(card,signal){
 for(const url of card.urls){
  if(signal.aborted)return null;
  const image=await loadImage(url,signal);
  if(image)return image;
 }
 return null;
}

function wrappedText(ctx,text,width,maxLines){
 const lines=[];
 let line='';
 for(const char of text.replace(/\s+/g,' ').trim()){
  if(ctx.measureText(line+char).width>width){
   lines.push(line.trimEnd());
   if(lines.length===maxLines){
    while(ctx.measureText(line+'…').width>width)line=line.slice(0,-1);
    lines[maxLines-1]=line.trimEnd()+'…';
    return lines;
   }
   line=char.trimStart();
  }else line+=char;
 }
 if(line)lines.push(line);
 return lines;
}

async function renderDeckImage(deck,signal){
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Canvas unavailable');
 const innerWidth=WIDTH-2*MARGIN;
 ctx.font='bold 46px '+FONT;
 const title=wrappedText(ctx,deck.name,innerWidth,2);
 ctx.font='26px '+FONT;
 const subtitle=wrappedText(ctx,deck.subtitle,innerWidth,2);
 const headerHeight=MARGIN+title.length*54+subtitle.length*32+18;
 const height=headerHeight+deck.sections.reduce((sum,section)=>
  sum+52+Math.ceil(section.cards.length/COLUMNS)*ROW_HEIGHT+12,0)+120;
 const scale=Math.min(1,8192/height,Math.sqrt(10000000/(WIDTH*height)));
 if(scale<.45)throw new Error('画像に収録できるカードの種類数を超えています。');
 canvas.width=Math.ceil(WIDTH*scale);
 canvas.height=Math.ceil(height*scale);
 ctx.scale(scale,scale);
 ctx.textBaseline='top';
 ctx.fillStyle='#102426';
 ctx.fillRect(0,0,WIDTH,height);
 let y=MARGIN;
 ctx.fillStyle='#f6efdf';
 ctx.font='bold 46px '+FONT;
 for(const line of title){ctx.fillText(line,MARGIN,y);y+=54;}
 ctx.fillStyle='#dccbad';
 ctx.font='26px '+FONT;
 for(const line of subtitle){ctx.fillText(line,MARGIN,y);y+=32;}
 y=headerHeight;
 let missing=0;
 for(const section of deck.sections){
  ctx.fillStyle='#d8b67b';
  ctx.fillRect(MARGIN,y,innerWidth,2);
  ctx.font='bold 28px '+FONT;
  ctx.fillText(section.label,MARGIN,y+11);
  ctx.textAlign='right';
  ctx.fillText(String(section.cards.reduce((sum,card)=>sum+card.qty,0)),WIDTH-MARGIN,y+11);
  ctx.textAlign='left';
  y+=52;
  for(let start=0;start<section.cards.length;start+=6){
   const batch=section.cards.slice(start,start+6);
   const images=await Promise.all(batch.map(card=>cardImage(card,signal)));
   if(signal.aborted)return null;
   batch.forEach((card,index)=>{
    const position=start+index;
    const x=MARGIN+(position%COLUMNS)*(CARD_WIDTH+GAP);
    const top=y+Math.floor(position/COLUMNS)*ROW_HEIGHT;
    const image=images[index];
    ctx.fillStyle='#20393a';
    ctx.fillRect(x,top,CARD_WIDTH,CARD_HEIGHT);
    if(image){
     const ratio=Math.min(CARD_WIDTH/image.naturalWidth,CARD_HEIGHT/image.naturalHeight);
     const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;
     ctx.drawImage(image,x+(CARD_WIDTH-width)/2,top+(CARD_HEIGHT-height)/2,width,height);
    }else{
     missing++;
     ctx.fillStyle='#dccbad';
     ctx.font='22px '+FONT;
     ctx.textAlign='center';
     ctx.fillText('画像なし',x+CARD_WIDTH/2,top+CARD_HEIGHT/2-12);
     ctx.textAlign='left';
    }
    const quantity='×'+card.qty;
    ctx.font='bold 24px '+FONT;
    const badgeWidth=Math.min(CARD_WIDTH-16,ctx.measureText(quantity).width+16);
    ctx.fillStyle='#0b191a';
    ctx.fillRect(x+8,top+8,badgeWidth,34);
    ctx.fillStyle='#fff4d9';
    ctx.fillText(quantity,x+16,top+12,badgeWidth-16);
    ctx.font='22px '+FONT;
    wrappedText(ctx,card.name,CARD_WIDTH-4,2).forEach((line,lineIndex)=>{
     ctx.fillText(line,x+2,top+CARD_HEIGHT+5+lineIndex*24);
    });
   });
  }
  y+=Math.ceil(section.cards.length/COLUMNS)*ROW_HEIGHT+12;
 }
 ctx.fillStyle='#d8b67b';
 ctx.fillRect(MARGIN,y,innerWidth,2);
 const logo=await loadImage(new URL('./atlantis-logo.svg',import.meta.url).href,signal);
 if(signal.aborted)return null;
 if(logo)ctx.drawImage(logo,(WIDTH-190)/2,y+11,190,38);
 else{
  ctx.textAlign='center';
  ctx.font='bold 30px '+FONT;
  ctx.fillText('ATLANTIS',WIDTH/2,y+12);
 }
 ctx.textAlign='center';
 ctx.font='19px '+FONT;
 ctx.fillText('alicelidde1e.github.io/atlantis',WIDTH/2,y+54);
 ctx.fillText('Card images: Scryfall / © Wizards of the Coast',WIDTH/2,y+80);
 try{
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('PNGを生成できませんでした。');
  return {blob,missing};
 }finally{
  canvas.width=canvas.height=1;
 }
}

export function createDeckImagePreview(dialog){
 const download=dialog.querySelector('#deck-image-download');
 const share=dialog.querySelector('#deck-image-share');
 const retry=dialog.querySelector('#deck-image-retry');
 const status=dialog.querySelector('#deck-image-status');
 const preview=dialog.querySelector('#deck-image-preview');
 let source,controller,url,file;
 function clear(){
  controller?.abort();
  preview.hidden=true;
  preview.removeAttribute('src');
  if(url)URL.revokeObjectURL(url);
  url=null;
  file=null;
  download.removeAttribute('href');
  download.setAttribute('aria-disabled','true');
  share.hidden=true;
  retry.hidden=true;
 }
 async function generate(){
  clear();
  const deck=source;
  if(!deck.sections.length){
   status.textContent='Main Deck または Sideboard に画像化できるカードがありません。';
   return;
  }
  controller=new AbortController();
  const {signal}=controller;
  status.textContent='デッキ画像を作成中…';
  try{
   const result=await renderDeckImage(deck,signal);
   if(signal.aborted||!dialog.open)return;
   const name=deck.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,100)||'atlantis-deck';
   file=new File([result.blob],name+'.png',{type:'image/png'});
   url=URL.createObjectURL(file);
   preview.src=url;
   preview.alt=deck.name+' — Deck Image';
   preview.hidden=false;
   download.href=url;
   download.download=file.name;
   download.removeAttribute('aria-disabled');
   share.hidden=!(navigator.share&&navigator.canShare?.({files:[file]}));
   const notes=[];
   if(deck.imageSuppression)notes.push(deck.imageSuppression);
   else if(result.missing)notes.push(result.missing+'枠のカード画像を取得できませんでした。');
   if(deck.unknown)notes.push('読み取れなかった行 '+deck.unknown+'件を出力から除きました。');
   status.textContent=notes.join(' ');
   retry.hidden=!result.missing||!!deck.imageSuppression;
  }catch(error){
   if(signal.aborted||!dialog.open)return;
   status.textContent=error.message.startsWith('画像に収録')?error.message:'デッキ画像を作成できませんでした。';
   retry.hidden=false;
  }
 }
 retry.addEventListener('click',generate);
 share.addEventListener('click',async()=>{
  if(!file)return;
  try{await navigator.share({files:[file]});}
  catch(error){if(error.name!=='AbortError'&&dialog.open)status.textContent='共有できませんでした。Download PNGをご利用ください。';}
 });
 dialog.addEventListener('close',()=>{if(!dialog.open){clear();source=null;}});
 return {open(deck){
  source=deck;
  dialog.showModal();
  dialog.querySelector('.deck-image-scroll').scrollTop=0;
  void generate();
 }};
}
