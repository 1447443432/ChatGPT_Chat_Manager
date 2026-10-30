(() => {
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let image, selection, start, chats = [];
const status = message => $('screenshotStatus').textContent = message;
const norm = text => String(text||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}\p{Cf}\u200b-\u200f\ufeff]/gu, '');
function similarity(a,b){if(!a||!b)return 0;let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const current=[i];for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=current;}return 1-previous[b.length]/Math.max(a.length,b.length);}
const point = event => { const box = canvas.getBoundingClientRect(); return {x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height}; };
function draw() {
  if (!image) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0);
  if (selection) { ctx.fillStyle='#1677ff30';ctx.strokeStyle='#1677ff';ctx.lineWidth=Math.max(2,canvas.width/500);ctx.fillRect(selection.x,selection.y,selection.width,selection.height);ctx.strokeRect(selection.x,selection.y,selection.width,selection.height); }
}
async function load(file) {
  if (!file?.type.startsWith('image/')) { status('请选择图片文件'); return; }
  if($('screenshotPanel').hidden)$('screenshot').click();
  const url=URL.createObjectURL(file);
  try { const img=new Image();img.src=url;await img.decode();image=img;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;selection=null;draw();canvas.hidden=false;$('recognize').disabled=false;$('results').replaceChildren();$('save').hidden=true;$('saveDelete').hidden=true;status('图片已加载，可拖动框选区域；不框选则识别整张图片。'); }
  catch { status('无法读取这张图片'); }
  finally { URL.revokeObjectURL(url);$('file').value=''; }
}
$('file').addEventListener('change',event=>load(event.target.files[0]));
document.addEventListener('paste',event=>{
  const file=[...event.clipboardData.items].find(item=>item.type.startsWith('image/'))?.getAsFile()
    || [...event.clipboardData.files].find(item=>item.type.startsWith('image/'));
  if(file){event.preventDefault();load(file);}
});
canvas.addEventListener('pointerdown',event=>{start=point(event);selection=null;canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!start)return;const p=point(event);selection={x:Math.max(0,Math.min(start.x,p.x)),y:Math.max(0,Math.min(start.y,p.y)),width:Math.abs(p.x-start.x),height:Math.abs(p.y-start.y)};draw();});
canvas.addEventListener('pointerup',()=>{start=null;if(selection&&(selection.width<10||selection.height<10))selection=null;draw();});
$('clear').addEventListener('click',()=>{image=null;selection=null;start=null;canvas.hidden=true;ctx.clearRect(0,0,canvas.width,canvas.height);$('file').value='';$('recognize').disabled=true;$('results').replaceChildren();$('save').hidden=true;$('saveDelete').hidden=true;status('图片和识别结果已清除，可重新粘贴或上传图片。');});
function show(lines) {
  const root=$('results');root.replaceChildren();let matched=0;
  for(const line of lines) {
    const value=norm(line);if(value.length<2)continue;
    const exact=chats.filter(c=>norm(c.title)===value);
    const contains=exact.length?exact:value.length>=3?chats.filter(c=>{const title=norm(c.title);return title.includes(value)||value.includes(title)&&title.length>=3;}):[];
    const fuzzy=exact.length||contains.length||value.length<4?[]:chats.map(c=>({chat:c,score:similarity(value,norm(c.title))})).filter(x=>x.score>=0.68).sort((a,b)=>b.score-a.score);
    const candidates=contains.length?contains:fuzzy.map(x=>x.chat);
    const row=document.createElement('div');row.className='result';
    const label=document.createElement('span');label.textContent=line;
    const match=document.createElement('small');match.className='matchStatus';match.textContent=candidates.length===0?'未找到匹配':exact.length===1?'标题唯一匹配':exact.length>1?`同名 ${exact.length} 条，请确认`:contains.length?`文字匹配 ${candidates.length} 条，请选择`:`容错匹配 ${candidates.length} 条，请选择`;
    const picker=document.createElement('div');picker.className='chatPicker';
    const search=document.createElement('input');search.type='search';search.placeholder='搜索聊天标题或 ID';search.setAttribute('aria-label',`搜索对应聊天：${line}`);search.autocomplete='off';
    const list=document.createElement('div');list.className='chatOptions';list.hidden=true;list.setAttribute('role','listbox');
    let selectedId='';
    const renderOptions=query=>{const q=norm(query);list.replaceChildren();const results=(q?chats.filter(c=>norm(c.title).includes(q)||norm(c.id).includes(q)):candidates).slice(0,30);for(const chat of results){const option=document.createElement('button');option.type='button';option.className='chatOption';option.textContent=`${chat.title} (${chat.id})`;option.setAttribute('role','option');option.addEventListener('click',()=>{selectedId=chat.id;search.value=`${chat.title} (${chat.id})`;list.hidden=true;});list.append(option);}if(!results.length){const empty=document.createElement('div');empty.className='chatOptionEmpty';empty.textContent='没有匹配的聊天';list.append(empty);}list.hidden=false;};
    search.addEventListener('focus',()=>renderOptions(selectedId?'':search.value));search.addEventListener('input',()=>{selectedId='';renderOptions(search.value);});search.addEventListener('keydown',event=>{if(event.key==='Escape')list.hidden=true;});
    document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target))list.hidden=true;});
    if(candidates.length===1){selectedId=candidates[0].id;search.value=`${candidates[0].title} (${candidates[0].id})`;matched++;}
    picker.append(search,list);
    const detail=document.createElement('div');detail.className='resultInfo';detail.append(match,picker);
    row.dataset.chatId='';Object.defineProperty(row,'selectedChatId',{get:()=>selectedId});
    row.append(label,detail);root.append(row);
  }
  $('save').hidden=!root.children.length;$('saveDelete').hidden=!root.children.length;
  status(`识别到 ${root.children.length} 行；${matched} 行已自动选中唯一候选。多条候选需要你手动确认。`);
}
$('recognize').addEventListener('click',async()=>{
  if(!image)return;
  $('recognize').disabled=true;status('正在本地识别截图，首次加载可能需要一些时间……');
  let worker;
  try {
    chats=window.getCurrentScannedChats?.()||[];
    if(!chats.length)throw Error('当前页面还没有可识别的聊天。请稍后重试，或点击“重新获取”。');
    const input=document.createElement('canvas');const crop=selection||{x:0,y:0,width:canvas.width,height:canvas.height};
    input.width=Math.round(crop.width);input.height=Math.round(crop.height);
    input.getContext('2d').drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,input.width,input.height);
    const base=chrome.runtime.getURL('ocr/');
    worker=await Tesseract.createWorker(['chi_sim','eng'],1,{workerPath:base+'worker.min.js',corePath:base,langPath:base.slice(0,-1),workerBlobURL:false});
    const result=await worker.recognize(input);
    show(result.data.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
  } catch(error) {status(`识别失败：${error.message}`);}
  finally {if(worker)await worker.terminate();$('recognize').disabled=false;}
});
function selectedChats(){
  const ids=[...$('results').querySelectorAll('.result')].map(row=>row.selectedChatId).filter(Boolean);
  if(!ids.length){status('请先选择截图对应的聊天');return [];}
  const latest=window.getCurrentScannedChats?.()||[];
  const found=[...new Set(ids)].map(id=>latest.find(c=>c.id===id&&c.title===chats.find(old=>old.id===id)?.title)).filter(Boolean);
  if(!found.length)status('选择的聊天已不在本次扫描结果中，或标题已变化。请重新获取并核对。');
  return found;
}
$('save').addEventListener('click',async()=>{
  const found=selectedChats();if(!found.length)return;
  const data=await chrome.storage.local.get(['whitelist']);const whitelist=data.whitelist||{};
  for(const chat of found)whitelist[chat.id]={title:chat.title,url:chat.url,createdAt:new Date().toISOString()};
  await chrome.storage.local.set({whitelist});status(`已核对并将 ${found.length} 条聊天加入手动白名单。`);
});
$('saveDelete').addEventListener('click',()=>{
  const found=selectedChats();if(!found.length)return;
  const added=window.addDeleteSelections?.(found)||0;
  status(added?`已将 ${added} 条聊天加入待删除。手动白名单中的聊天需要先移出保护清单。`:'未加入待删除：请先重新获取，并检查所选聊天是否已在手动白名单中。');
  if(added){$('deleteMode').value='selected';$('deleteMode').dispatchEvent(new Event('change'));document.querySelector('.tab[data-panel="deletePanel"]').click();}
});
})();
