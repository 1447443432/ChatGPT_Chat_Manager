(() => {
  if (window.__cgptWhitelistHelper) return;
  window.__cgptWhitelistHelper = true;
  const CHAT = /(?:^|\/)c\/([a-zA-Z0-9-]+)(?:[/?#]|$)/;
  const normalize = href => { try { const url=new URL(href,location.href); const m=url.pathname.match(CHAT); return m ? m[1] : null; } catch {return null;} };
  const normTitle = s => (s||'').replace(/\s+/g,' ').trim();
  const rowFor = a => a.closest('div[data-testid*="conversation"],li,div.group,div[class*="group"],div[class*="relative"]') || a.parentElement;
  const isProject = a => /\/g\/|\/project\//i.test(new URL(a.href).pathname) || !!a.closest('[data-project-id]');
  function getChats() {
    const result = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      const id = normalize(a.href);
      if (!id) continue;
      const title = normTitle(a.getAttribute('title') || a.innerText || a.textContent || '');
      if (!title || title.length > 250) continue;
      const row = rowFor(a);
      const box = a.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      result.set(id,{id,title,url:a.href,project:isProject(a),visible:box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth});
    }
    return [...result.values()];
  }
  const findAnchor = id => [...document.querySelectorAll('a[href]')].find(a => normalize(a.href)===id);
  const storageGet = keys => new Promise(resolve=>chrome.storage.local.get(keys,resolve));
  const storageSet = obj => new Promise(resolve=>chrome.storage.local.set(obj,resolve));
  function notify(message) {
    const el=document.createElement('div');el.textContent=message;
    Object.assign(el.style,{position:'fixed',bottom:'24px',right:'24px',zIndex:'2147483647',background:'#111827',color:'white',padding:'12px 18px',borderRadius:'10px',fontSize:'14px',boxShadow:'0 5px 25px #0005'});
    document.body.append(el);setTimeout(()=>el.remove(),3500);
  }
  async function selectRectangle() {
    if (document.getElementById('cgpt-select-overlay')) return;
    const overlay=document.createElement('div');overlay.id='cgpt-select-overlay';
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483646',cursor:'crosshair',background:'#0088ff12',touchAction:'none'});
    const hint=document.createElement('div');hint.textContent='拖动框选左侧聊天条目加入白名单 · Esc 取消';
    Object.assign(hint.style,{position:'fixed',top:'15px',left:'50%',transform:'translateX(-50%)',background:'#111827',color:'white',padding:'10px 15px',borderRadius:'8px',font:'14px sans-serif',pointerEvents:'none'});
    const rectEl=document.createElement('div'); Object.assign(rectEl.style,{position:'fixed',border:'2px solid #1677ff',background:'#1677ff33',pointerEvents:'none',display:'none'});
    overlay.append(hint,rectEl);document.body.append(overlay);
    let start=null;const cleanup=()=>{overlay.remove();document.removeEventListener('keydown',onKey,true);};
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cleanup();}};
    document.addEventListener('keydown',onKey,true);
    overlay.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};overlay.setPointerCapture(e.pointerId);rectEl.style.display='block';});
    overlay.addEventListener('pointermove',e=>{if(!start)return;const l=Math.min(e.clientX,start.x),t=Math.min(e.clientY,start.y);Object.assign(rectEl.style,{left:l+'px',top:t+'px',width:Math.abs(e.clientX-start.x)+'px',height:Math.abs(e.clientY-start.y)+'px'});});
    overlay.addEventListener('pointerup',async e=>{
      if(!start)return;
      const l=Math.min(e.clientX,start.x),r=Math.max(e.clientX,start.x),t=Math.min(e.clientY,start.y),b=Math.max(e.clientY,start.y);
      // Avoid accidental clicks: require a real region.
      if(r-l<12||b-t<12){cleanup();notify('框选区域过小，未修改白名单');return;}
      const picks=[];
      for(const a of document.querySelectorAll('a[href]')){
        const id=normalize(a.href);if(!id)continue;
        const q=a.getBoundingClientRect();
        const intersection=Math.max(0,Math.min(r,q.right)-Math.max(l,q.left))*Math.max(0,Math.min(b,q.bottom)-Math.max(t,q.top));
        const area=q.width*q.height;
        if(area>0&&intersection/area>=0.3){const title=normTitle(a.getAttribute('title')||a.innerText||a.textContent);if(title)picks.push({id,title,url:a.href,project:isProject(a)});}
      }
      cleanup();const data=await storageGet(['whitelist']);const whitelist=data.whitelist||{};
      for(const c of picks)whitelist[c.id]={title:c.title,url:c.url,createdAt:new Date().toISOString()};
      await storageSet({whitelist});notify(`成功保护 ${new Set(picks.map(c=>c.id)).size} 条聊天（仅当前屏幕）`);
    });
  }
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg.type==='SCAN'){sendResponse({chats:getChats(),url:location.href});return;}
    if(msg.type==='FRAME'){selectRectangle();sendResponse({ok:true});return;}
    if(msg.type==='HIGHLIGHT'){
      const a=findAnchor(msg.id);if(a){a.scrollIntoView({block:'center'});a.style.outline='2px solid #1677ff';setTimeout(()=>a.style.outline='',2000);sendResponse({ok:true});}else sendResponse({ok:false});return;
    }
  });
})();
