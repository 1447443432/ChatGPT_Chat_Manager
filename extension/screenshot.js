(() => {
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let image, selection, start, chats = [];
const status = message => $('screenshotStatus').textContent = message;
const norm = text => text.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
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
  try { const img=new Image();img.src=url;await img.decode();image=img;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;selection=null;draw();canvas.hidden=false;$('recognize').disabled=false;$('results').replaceChildren();$('save').hidden=true;status('图片已加载，可拖动框选区域；不框选则识别整张图片。'); }
  catch { status('无法读取这张图片'); }
  finally { URL.revokeObjectURL(url); }
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
$('clear').addEventListener('click',()=>{selection=null;draw();});
function show(lines) {
  const root=$('results');root.replaceChildren();let matched=0;
  for(const line of lines) {
    const value=norm(line);if(value.length<2)continue;
    const candidates=chats.filter(c=>{const title=norm(c.title);return title===value||(value.length>=4&&title.includes(value));});
    const row=document.createElement('div');row.className='result';
    const label=document.createElement('span');label.textContent=line;
    const select=document.createElement('select');select.setAttribute('aria-label',`对应聊天：${line}`);
    select.add(new Option('不加入白名单',''));
    for(const chat of chats)select.add(new Option(`${chat.title} (${chat.id})`,chat.id));
    if(candidates.length===1){select.value=candidates[0].id;matched++;}
    row.append(label,select);root.append(row);
  }
  $('save').hidden=!root.children.length;
  status(`识别到 ${root.children.length} 行；自动匹配 ${matched} 行。请逐项核对，未匹配的可手动选择聊天。`);
}
$('recognize').addEventListener('click',async()=>{
  if(!image)return;
  $('recognize').disabled=true;status('正在本地识别截图，首次加载可能需要一些时间……');
  let worker;
  try {
    const data=await chrome.storage.local.get(['scan']);chats=data.scan||[];
    if(!chats.length)throw Error('没有已扫描的聊天。请先在 ChatGPT 页面执行“扫描聊天和项目”。');
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
$('save').addEventListener('click',async()=>{
  const ids=[...$('results').querySelectorAll('select')].map(s=>s.value).filter(Boolean);
  if(!ids.length){status('请先选择要加入白名单的聊天');return;}
  const data=await chrome.storage.local.get(['whitelist']);const whitelist=data.whitelist||{};
  for(const id of new Set(ids)){const chat=chats.find(c=>c.id===id);if(chat)whitelist[id]={title:chat.title,url:chat.url,createdAt:new Date().toISOString()};}
  await chrome.storage.local.set({whitelist});status(`已将 ${new Set(ids).size} 条聊天加入白名单。`);
});
})();
