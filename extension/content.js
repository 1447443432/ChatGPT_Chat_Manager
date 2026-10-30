(() => {
  if (window.__cgptWhitelistHelper) return;
  window.__cgptWhitelistHelper = true;
  const CHAT = /(?:^|\/)c\/([a-zA-Z0-9-]+)(?:[/?#]|$)/;
  const projectId = value => value?.match(/^g-p-[a-f0-9]{32}/i)?.[0] || value || null;
  const normalize = href => { try { const url=new URL(href,location.href); const m=url.pathname.match(CHAT); return m ? m[1] : null; } catch {return null;} };
  const normTitle = s => (s||'').replace(/\s+/g,' ').trim();
  const rowFor = a => a.closest('div[data-testid*="conversation"],li,div.group,div[class*="group"],div[class*="relative"]') || a.parentElement;
  const isProject = a => /\/g\/|\/project\//i.test(new URL(a.href).pathname) || !!a.closest('[data-project-id]');
  const currentProject = () => {
    const match=location.pathname.match(/^\/g\/([^/]+)(?:\/project|\/c\/[^/]+)?\/?$/);
    const heading=normTitle(document.querySelector('main h1,main [data-testid*="project-title"]')?.textContent);
    const title=heading||document.title.replace(/\s*[-|].*$/,'').trim();
    return match ? {id:projectId(match[1]),title:title&&title!=='ChatGPT'?title:match[1]} : null;
  };
  const projectFor = a => {
    const path=new URL(a.href).pathname;
    const direct=path.match(/^\/g\/([^/]+)\/c\//);
    if(direct)return projectId(direct[1]);
    const marker=a.closest('[data-project-id]')?.getAttribute('data-project-id');
    return projectId(marker) || (a.closest('main') ? currentProject()?.id : null);
  };
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
      const previous=result.get(id);
      result.set(id,{id,title,url:a.href,project:isProject(a)||previous?.project||false,projectId:projectFor(a)||previous?.projectId||null,visible:box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth});
    }
    return [...result.values()];
  }
  function getProjects() {
    const projects=new Map();
    for(const marker of document.querySelectorAll('[data-sidebar-project-container-id^="project:"]')){
      const value=marker.getAttribute('data-sidebar-project-container-id');
      const id=projectId(value?.slice('project:'.length));
      if(!id)continue;
      const row=marker.closest('[role="button"][aria-expanded]')||marker.closest('[role="button"]')||marker.parentElement;
      const title=normTitle(row?.querySelector('[data-marquee-text="true"],[data-marquee-content="true"]')?.textContent||row?.innerText);
      if(title&&title.length<=80)projects.set(id,{id,title,url:`https://chatgpt.com/g/${id}/project`});
    }
    for(const a of document.querySelectorAll('a[href]')){
      const path=new URL(a.href).pathname;
      const match=path.match(/^\/g\/([^/]+)(?:\/project)?\/?$/);
      if(!match)continue;
      const title=normTitle(a.innerText||a.textContent||a.getAttribute('title'));
      const id=projectId(match[1]);
      if(title&&title.length<=80&&!projects.has(id))projects.set(id,{id,title,url:a.href});
    }
    for(const button of document.querySelectorAll('button,[role="button"]')){
      const title=normTitle(button.innerText||button.textContent||button.getAttribute('aria-label'));
      if(!title||title.length>80||/^(更多|菜单|打开|关闭|选项|项目|ChatGPT)$/.test(title))continue;
      for(let group=button.parentElement,depth=0;group&&depth<4;group=group.parentElement,depth++){
        const ids=new Set([...group.querySelectorAll('a[href]')].map(a=>projectId(new URL(a.href).pathname.match(/^\/g\/([^/]+)\/c\//)?.[1]||a.closest('[data-project-id]')?.getAttribute('data-project-id'))).filter(Boolean));
        if(ids.size!==1)continue;
        const id=[...ids][0];
        if([...group.querySelectorAll('a[href]')].some(a=>normTitle(a.innerText||a.textContent)===title))continue;
        if(!projects.has(id))projects.set(id,{id,title,url:`https://chatgpt.com/g/${id}/project`});
        break;
      }
    }
    for(const a of document.querySelectorAll('a[href]')){
      const id=projectId(new URL(a.href).pathname.match(/^\/g\/([^/]+)\/c\//)?.[1]);
      if(!id||projects.has(id))continue;
      const box=a.getBoundingClientRect();
      const sidebar=a.closest('nav,aside,[data-testid*="sidebar"]')||document;
      let nearest=null;
      for(const el of sidebar.querySelectorAll('button,[role="button"],div,span')){
        if(el.closest('a[href]')||el.contains(a)||el.querySelector('a[href]'))continue;
        const rect=el.getBoundingClientRect();
        if(rect.height<12||rect.height>58||rect.bottom>box.top+3||box.top-rect.bottom>110||rect.left>box.left+12)continue;
        const title=normTitle(el.innerText||el.textContent);
        if(!title||title.length>80||title===a.innerText||/^(项目|最近|新聊天|ChatGPT)$/.test(title))continue;
        if(!nearest||rect.bottom>nearest.bottom)nearest={title,bottom:rect.bottom};
      }
      if(nearest)projects.set(id,{id,title:nearest.title,url:`https://chatgpt.com/g/${id}/project`});
    }
    return [...projects.values()];
  }
  async function scanAll() {
    const chats=new Map(),projects=new Map();
    const collect=()=>{for(const c of getChats()){const old=chats.get(c.id);chats.set(c.id,{...old,...c,projectId:c.projectId||old?.projectId||null});}for(const p of getProjects())projects.set(p.id,p);};
    collect();
    const containers=new Set();
    for(const a of document.querySelectorAll('a[href]')){
      if(!normalize(a.href)&&!/^\/g\/[^/]+(?:\/project)?\/?$/.test(new URL(a.href).pathname))continue;
      for(let el=a.parentElement;el&&el!==document.body;el=el.parentElement){if(el.scrollHeight>el.clientHeight+80&&el.clientHeight>80&&/auto|scroll/.test(getComputedStyle(el).overflowY)){containers.add(el);break;}}
    }
    let truncated=false;
    for(const el of containers){
      const original=el.scrollTop;let stalled=0;
      for(let i=0;i<80;i++){
        const before=el.scrollTop;el.scrollTop=Math.min(el.scrollHeight,el.scrollTop+Math.max(150,el.clientHeight*.85));
        await new Promise(resolve=>setTimeout(resolve,300));collect();
        if(el.scrollTop===before){if(++stalled>=3)break;}else stalled=0;
        if(i===79)truncated=true;
      }
      el.scrollTop=original;
    }
    scanSnapshot={token:crypto.randomUUID(),items:chats};
    return {chats:[...chats.values()],projects:[...projects.values()],project:currentProject(),truncated,scanToken:scanSnapshot.token};
  }
  let scanSnapshot=null;
  const waitFor=(read,timeout=2500)=>new Promise((resolve,reject)=>{const end=Date.now()+timeout;const tick=()=>{const value=read();if(value)return resolve(value);if(Date.now()>end)return reject(Error('ChatGPT 页面未显示预期的操作菜单'));setTimeout(tick,80);};tick();});
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const exactText=(el,values)=>values.includes(normTitle(el.textContent||el.getAttribute('aria-label')));
  const nativeClick=el=>{for(const type of ['pointerdown','mousedown','pointerup','mouseup'])el.dispatchEvent(type.startsWith('pointer')?new PointerEvent(type,{bubbles:true,pointerType:'mouse'}):new MouseEvent(type,{bubbles:true}));el.click();};
  function conversationRow(anchor,id){
    const stable=anchor.closest('li[data-testid^="history-item-"],[data-testid^="history-item-"],[data-sidebar-item="true"]');
    if(stable)return stable;
    let fallback=null;
    for(let row=anchor.parentElement,depth=0;row&&row!==document.body&&depth<10;row=row.parentElement,depth++){
      const ids=new Set([...row.querySelectorAll('a[href]')].map(link=>normalize(link.href)).filter(Boolean));
      if(ids.size>1)break;
      if(ids.has(id)){
        fallback=row;
        if(row.querySelector('button[data-testid*="options"],button[aria-haspopup="menu"],button[aria-label*="options" i],button[aria-label*="选项"]'))return row;
      }
    }
    return fallback||anchor.parentElement;
  }
  function rowMenuButton(row,title){
    const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(visible);
    const selectors=buttons.filter(button=>{
      const testid=button.getAttribute('data-testid')||'';
      const label=button.getAttribute('aria-label')||button.getAttribute('title')||'';
      return /history-item-.*-options/i.test(testid)||/conversation options|对话选项|更多选项|more options/i.test(label)||(/options|选项|菜单/i.test(label)&&button.getAttribute('aria-haspopup')==='menu');
    });
    if(selectors.length===1)return selectors[0];
    if(selectors.length>1)return null;
    const expected=buttons.filter(button=>normTitle(button.getAttribute('aria-label')||button.getAttribute('title'))===`Open conversation options for ${title}`||normTitle(button.getAttribute('aria-label')||button.getAttribute('title'))===`打开${title}的对话选项`);
    return expected.length===1?expected[0]:null;
  }
  async function deleteOne(id,token,mode){
    if(!scanSnapshot||token!==scanSnapshot.token||!scanSnapshot.items.has(id))throw Error('扫描结果已失效，请重新获取');
    if(!['selected','candidates'].includes(mode))throw Error('删除范围无效，已停止');
    const data=await storageGet(['whitelist','keywords','excludedProjects','projectChats','projectChatOverrides']);
    const a=findAnchor(id);if(!a||!visible(a))throw Error('聊天未加载在当前侧栏，已跳过');
    const pid=projectFor(a)||data.projectChats?.[id];
    const title=normTitle(a.getAttribute('title')||a.innerText||a.textContent);
    const scanned=scanSnapshot.items.get(id);
    if(title!==scanned.title||projectFor(a)!==scanned.projectId)throw Error('聊天标题或项目归属已变化，请重新获取');
    const words=(data.keywords||'').split(/[,，\n]/).map(s=>s.trim().toLocaleLowerCase()).filter(Boolean);
    if(data.whitelist?.[id]||(mode==='candidates'&&(words.some(w=>title.toLocaleLowerCase().includes(w))||(pid&&(data.projectChatOverrides?.[id]??!data.excludedProjects?.[pid])))))throw Error('此聊天目前受白名单或项目规则保护，已跳过');
    a.scrollIntoView({block:'center'});
    await new Promise(resolve=>setTimeout(resolve,120));
    const current=findAnchor(id);if(!current)throw Error('聊天滚动后未加载在当前侧栏，已跳过');
    const row=conversationRow(current,id);
    if(!row)throw Error('未找到该聊天对应的侧栏行，已跳过');
    row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
    const box=current.getBoundingClientRect(),x=box.left+Math.min(box.width-2,Math.max(2,box.width*.7)),y=box.top+box.height/2;
    const hit=document.elementFromPoint(x,y)||current;
    hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y,pointerType:'mouse'}));
    hit.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:x,clientY:y}));
    const menu=await waitFor(()=>rowMenuButton(row,title),1800).catch(()=>{throw Error('ChatGPT 未在该聊天行提供可定位的“更多”菜单；请确认聊天行已加载，已跳过');});
    if([...document.querySelectorAll('[role="menu"],[role="dialog"],[role="alertdialog"]')].some(visible))throw Error('页面上已有菜单或对话框，请关闭后重新获取');
    nativeClick(menu);
    const choice=await waitFor(()=>{const options=[...document.querySelectorAll('[role="menuitem"], [data-radix-collection-item], [role="menu"] button')].filter(visible).filter(el=>exactText(el,['删除','Delete','删除聊天','Delete chat']));return options.length===1?options[0]:null;});
    nativeClick(choice);
    const confirm=await waitFor(()=>{const direct=document.querySelector('[data-testid="delete-conversation-confirm-button"]');if(direct&&visible(direct))return direct;const dialog=[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(visible);if(!dialog)return null;const buttons=[...dialog.querySelectorAll('button,[role="button"]')].filter(visible).filter(el=>exactText(el,['删除','Delete','删除聊天','Delete chat']));return buttons.length===1?buttons[0]:null;});
    nativeClick(confirm);
    await waitFor(()=>!findAnchor(id),6000).catch(()=>{throw Error('点击确认后聊天仍在列表中，结果未确认');});
    scanSnapshot.items.delete(id);
    return {ok:true,id,title};
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
        if(area>0&&intersection/area>=0.3){const title=normTitle(a.getAttribute('title')||a.innerText||a.textContent);if(title)picks.push({id,title,url:a.href,project:isProject(a),projectId:projectFor(a)});}
      }
      cleanup();const data=await storageGet(['whitelist']);const whitelist=data.whitelist||{};
      for(const c of picks)whitelist[c.id]={title:c.title,url:c.url,createdAt:new Date().toISOString()};
      await storageSet({whitelist});notify(`成功保护 ${new Set(picks.map(c=>c.id)).size} 条聊天（仅当前屏幕）`);
    });
  }
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg.type==='SCAN'){scanAll().then(sendResponse).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='PROJECTS'){sendResponse({projects:getProjects(),project:currentProject()});return;}
    if(msg.type==='DELETE_ONE'){deleteOne(msg.id,msg.scanToken,msg.mode).then(sendResponse).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='FRAME'){selectRectangle();sendResponse({ok:true});return;}
    if(msg.type==='HIGHLIGHT'){
      const a=findAnchor(msg.id);if(a){a.scrollIntoView({block:'center'});a.style.outline='2px solid #1677ff';setTimeout(()=>a.style.outline='',2000);sendResponse({ok:true});}else sendResponse({ok:false});return;
    }
  });
})();
