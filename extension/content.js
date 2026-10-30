(() => {
  if (window.__cgptWhitelistHelper) return;
  window.__cgptWhitelistHelper = true;
  const CHAT = /(?:^|\/)c\/([a-zA-Z0-9-]+)(?:[/?#]|$)/;
  const projectId = value => value?.match(/^g-p-[a-f0-9]{32}/i)?.[0] || value || null;
  const normalize = href => { try { const url=new URL(href,location.href); const m=url.pathname.match(CHAT); return m ? m[1] : null; } catch {return null;} };
  const normTitle = s => (s||'').replace(/\s+/g,' ').trim();
  const chatTitle = anchor => {
    const dedicated=anchor.querySelector('[data-testid*="conversation-title"],[data-testid*="title"],[data-marquee-text="true"]');
    const explicit=dedicated?.textContent||anchor.getAttribute('title');
    if(explicit&&normTitle(explicit))return normTitle(explicit);
    return (anchor.innerText||anchor.textContent||'').split(/\r?\n/).map(normTitle).find(Boolean)||'';
  };
  const deletedInTab=new Set();
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
      if (!id||deletedInTab.has(id)) continue;
      const title = chatTitle(a);
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
  let liveWatchStarted=false,liveUpdateTimer=null;
  function publishLoadedChats(){
    if(!scanSnapshot)return;
    const changed=[];
    for(const chat of getChats()){
      const previous=scanSnapshot.items.get(chat.id);
      const merged={...previous,...chat,projectId:chat.projectId||previous?.projectId||null};
      if(!previous||previous.title!==merged.title||previous.projectId!==merged.projectId){
        scanSnapshot.items.set(chat.id,merged);
        changed.push(merged);
      }
    }
    if(changed.length)chrome.runtime.sendMessage({type:'LIVE_CHATS',scanToken:scanSnapshot.token,chats:changed,projects:getProjects()}).catch(()=>{});
  }
  function scheduleLoadedChats(){
    if(liveUpdateTimer)clearTimeout(liveUpdateTimer);
    liveUpdateTimer=setTimeout(()=>{liveUpdateTimer=null;publishLoadedChats();},450);
  }
  function startLiveWatching(){
    if(liveWatchStarted)return;
    liveWatchStarted=true;
    new MutationObserver(scheduleLoadedChats).observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('scroll',scheduleLoadedChats,{capture:true,passive:true});
  }
  const waitFor=(read,timeout=2500)=>new Promise((resolve,reject)=>{const end=Date.now()+timeout;const tick=()=>{const value=read();if(value)return resolve(value);if(Date.now()>end)return reject(Error('ChatGPT 页面未显示预期的操作菜单'));setTimeout(tick,80);};tick();});
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const exactText=(el,values)=>values.includes(normTitle(el.textContent||el.getAttribute('aria-label')));
  const nativeClick=el=>{for(const type of ['pointerdown','mousedown','pointerup','mouseup'])el.dispatchEvent(type.startsWith('pointer')?new PointerEvent(type,{bubbles:true,pointerType:'mouse'}):new MouseEvent(type,{bubbles:true}));el.click();};
  function conversationRow(anchor,id){
    const stable=anchor.closest('li[data-testid^="history-item-"],[data-sidebar-item="true"]');
    if(stable)return stable;
    let fallback=null;
    for(let row=anchor.parentElement,depth=0;row&&row!==document.body&&depth<10;row=row.parentElement,depth++){
      const ids=new Set([...row.querySelectorAll('a[href]')].map(link=>normalize(link.href)).filter(Boolean));
      if(ids.size>1)break;
      if(ids.has(id)){
        fallback=row;
        if(row.matches('[data-testid^="history-item-"]')||row.querySelector('button[data-testid*="options"],button[aria-haspopup="menu"],button[aria-label*="options" i],button[aria-label*="选项"]'))return row;
      }
    }
    return fallback||anchor.parentElement;
  }
  function rowMenuButton(row,title,id){
    const expectedLabel=`Open conversation options for ${title}`;
    const localizedLabel=`打开${title}的对话选项`;
    const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(visible);
    const selectors=buttons.filter(button=>{
      const testid=button.getAttribute('data-testid')||'';
      const label=button.getAttribute('aria-label')||button.getAttribute('title')||'';
      const exactId=testid===`history-item-${id}-options`;
      const exactLabel=[expectedLabel,localizedLabel].includes(normTitle(label));
      return exactId||exactLabel||(/history-item-.*-options/i.test(testid)&&(/conversation options|对话选项|更多选项|more options/i.test(label)||button.getAttribute('aria-haspopup')==='menu'))||(/conversation options|对话选项|更多选项|more options/i.test(label)&&button.getAttribute('aria-haspopup')==='menu');
    });
    if(selectors.length===1)return selectors[0];
    if(selectors.length>1)return null;
    // Some ChatGPT layouts mount the options button next to (rather than inside) the
    // anchor's closest row. Match the stable conversation id/title globally, then
    // let the caller's menu/dialog checks guard the destructive action.
    const global=[...document.querySelectorAll('button[data-testid],button[aria-label],button[title],[role="button"][data-testid],[role="button"][aria-label]')].filter(visible).filter(button=>{
      const testid=button.getAttribute('data-testid')||'';
      const label=normTitle(button.getAttribute('aria-label')||button.getAttribute('title'));
      return testid===`history-item-${id}-options`||label===expectedLabel||label===localizedLabel;
    });
    if(global.length===1)return global[0];
    const expected=buttons.filter(button=>normTitle(button.getAttribute('aria-label')||button.getAttribute('title'))===expectedLabel||normTitle(button.getAttribute('aria-label')||button.getAttribute('title'))===localizedLabel);
    return expected.length===1?expected[0]:null;
  }
  async function deleteViaApi(id){
    let session;
    try{
      const sessionResponse=await fetch('/api/auth/session',{credentials:'include'});
      if(!sessionResponse.ok)return false;
      session=await sessionResponse.json();
    }catch{return false;}
    if(!session?.accessToken)return false;
    let response;
    try{
      response=await fetch(`/backend-api/conversation/${encodeURIComponent(id)}`,{
        method:'PATCH',
        credentials:'include',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.accessToken}`},
        body:JSON.stringify({is_visible:false})
      });
    }catch{throw Error('删除请求连接中断，无法确认服务端结果；请重新获取列表核对后再操作');}
    if(response.status===204)return true;
    if(!response.ok){
      if(response.status===429)throw Error('ChatGPT 暂时限制了删除请求，请稍后重试');
      if(response.status>=500)throw Error(`ChatGPT 服务端返回 ${response.status}，删除结果未确认；请重新获取列表核对`);
      return false;
    }
    let result;
    try{result=await response.json();}catch{throw Error('ChatGPT 未返回可核验的删除结果；请重新获取列表核对后再操作');}
    if(result?.success!==true)throw Error('ChatGPT 未明确确认删除成功；请重新获取列表核对后再操作');
    return true;
  }
  function moveMenuCandidates(){return [...document.querySelectorAll('[role="menuitem"],[role="menu"] button,[role="menu"] [role="button"],[role="option"]')].filter(visible);}
  function menuProjectIds(element){const values=[element.getAttribute('data-project-id'),element.closest('[data-project-id]')?.getAttribute('data-project-id'),... [...element.querySelectorAll('a[href]')].map(link=>new URL(link.href).pathname.match(/^\/g\/([^/]+)/)?.[1])];return values.filter(Boolean).map(projectId);}
  async function locateChatLink(id){
    let anchor=findAnchor(id);if(anchor)return anchor;
    const containers=new Set();
    for(const link of document.querySelectorAll('a[href]')){if(!normalize(link.href))continue;for(let el=link.parentElement;el&&el!==document.body;el=el.parentElement){if(el.scrollHeight>el.clientHeight+80&&el.clientHeight>80&&/auto|scroll/.test(getComputedStyle(el).overflowY)){containers.add(el);break;}}}
    for(const container of containers){const original=container.scrollTop;container.scrollTop=0;await new Promise(resolve=>setTimeout(resolve,180));
      for(let i=0;i<80;i++){anchor=findAnchor(id);if(anchor)return anchor;const before=container.scrollTop;container.scrollTop=Math.min(container.scrollHeight,container.scrollTop+Math.max(160,container.clientHeight*.8));await new Promise(resolve=>setTimeout(resolve,180));if(container.scrollTop===before)break;}
      container.scrollTop=original;await new Promise(resolve=>setTimeout(resolve,120));
    }
    return findAnchor(id);
  }
  function rowForChatMenu(anchor,id,title){
    const row=conversationRow(anchor,id);const box=anchor.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));row.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
    const hit=document.elementFromPoint(box.left+Math.max(2,Math.min(box.width-2,box.width*.72)),box.top+box.height/2)||anchor;
    hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:box.left+box.width*.72,clientY:box.top+box.height/2,pointerType:'mouse'}));
    hit.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:box.left+box.width*.72,clientY:box.top+box.height/2}));
    return waitFor(()=>rowMenuButton(row,title,id),3500).catch(()=>{throw Error('未找到该聊天的选项菜单；本条未移动');});
  }
  async function moveOne(id,title,token,targetProjectId){
    if(!scanSnapshot||token!==scanSnapshot.token||!scanSnapshot.items.has(id))throw Error('扫描结果已失效，请重新获取');
    let anchor=await locateChatLink(id);if(!anchor||!visible(anchor))throw Error('聊天当前未加载在侧栏，未移动');
    anchor.scrollIntoView({block:'center'});await new Promise(resolve=>setTimeout(resolve,120));anchor=findAnchor(id)||anchor;
    const scanned=scanSnapshot.items.get(id),liveTitle=chatTitle(anchor);
    if(liveTitle!==title||scanned.title!==title||projectFor(anchor)!==scanned.projectId)throw Error('聊天标题或所属项目已变化，请重新获取后再试');
    const target=targetProjectId?getProjects().find(project=>project.id===targetProjectId):null;
    if(targetProjectId&&!target)throw Error('目标项目不在当前页面项目列表中，请先打开项目页刷新列表');
    if((projectFor(anchor)||null)===(targetProjectId||null))return {ok:true,id,title,projectId:targetProjectId||null,unchanged:true};
    if([...document.querySelectorAll('[role="menu"],[role="dialog"],[role="alertdialog"]')].some(visible))throw Error('ChatGPT 页面上已有菜单或对话框，请关闭后再试');
    nativeClick(await rowForChatMenu(anchor,id,title));
    const action=targetProjectId?['移至项目','移动到项目','Move to project']:['从项目中移除','移出项目','Remove from project'];
    const moveItem=await waitFor(()=>{const matches=moveMenuCandidates().filter(item=>action.includes(normTitle(item.textContent||item.getAttribute('aria-label'))));return matches.length===1?matches[0]:null;}).catch(()=>{throw Error(targetProjectId?'菜单中没有可用的“移至项目”操作':'菜单中没有“从项目中移除”操作；此聊天可能已不在项目中');});
    nativeClick(moveItem);
    if(targetProjectId){
      const destinations=await waitFor(()=>{const options=moveMenuCandidates();const withId=options.filter(item=>menuProjectIds(item).includes(targetProjectId));const matches=withId.length?withId:options.filter(item=>normTitle(item.textContent||item.getAttribute('aria-label'))===normTitle(target.title));return matches.length?matches:null;}).catch(()=>{throw Error('ChatGPT 未显示目标项目选项；本条未移动');});
      if(destinations.length!==1)throw Error('存在同名项目，无法安全确定目标；本条未移动');
      nativeClick(destinations[0]);
    }
    await waitFor(()=>{const current=findAnchor(id);return current&&(projectFor(current)||null)===(targetProjectId||null);},6500).catch(()=>{throw Error('已提交项目操作，但无法从侧栏确认归属变化；请先刷新项目列表核对，勿重复批量操作');});
    const current=findAnchor(id);if(current){const item=scanSnapshot.items.get(id);scanSnapshot.items.set(id,{...item,projectId:targetProjectId||null,project:!!targetProjectId,url:current.href});}
    return {ok:true,id,title,projectId:targetProjectId||null};
  }
  async function createProject(title){
    title=normTitle(title);if(!title||title.length>80)throw Error('项目名称需为 1 到 80 个字符');
    const current=getProjects();if(current.some(project=>normTitle(project.title)===title))throw Error('已存在同名项目；请直接选择现有项目');
    const launchers=[...document.querySelectorAll('button,[role="button"],a[href]')].filter(visible).filter(el=>['新建项目','New project','Create project'].includes(normTitle(el.innerText||el.textContent||el.getAttribute('aria-label'))));
    if(launchers.length!==1)throw Error(launchers.length?'页面存在多个新建项目入口，无法安全选择':'未找到 ChatGPT 的“新建项目”入口');
    nativeClick(launchers[0]);
    const dialog=await waitFor(()=>[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(visible),3500).catch(()=>{throw Error('ChatGPT 未打开新建项目窗口');});
    const fields=[...dialog.querySelectorAll('input:not([type="checkbox"]),[contenteditable="true"]')].filter(visible);
    if(fields.length!==1)throw Error('新建项目窗口中的名称输入框无法唯一确认');
    const field=fields[0];if(field.isContentEditable){field.textContent=title;field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:title}));}else{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)throw Error('浏览器无法安全填写项目名称');setter.call(field,title);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}
    const submits=[...dialog.querySelectorAll('button,[role="button"]')].filter(visible).filter(el=>['创建','新建','Create','Create project'].includes(normTitle(el.textContent||el.getAttribute('aria-label'))));
    if(submits.length!==1)throw Error('新建项目窗口的确认按钮无法唯一确认');
    nativeClick(submits[0]);
    return waitFor(()=>getProjects().find(project=>project.title===title),8000).then(project=>({ok:true,project})).catch(()=>{throw Error('已提交新建项目，但暂时无法从侧栏核对；请刷新确认后再创建一次');});
  }
  async function deleteOne(id,token,mode){
    if(!scanSnapshot||token!==scanSnapshot.token||!scanSnapshot.items.has(id))throw Error('扫描结果已失效，请重新获取');
    if(!['selected','candidates'].includes(mode))throw Error('删除范围无效，已停止');
    const data=await storageGet(['whitelist','keywords','excludedProjects','projectChats','projectChatOverrides']);
    const a=findAnchor(id);if(!a||!visible(a))throw Error('聊天未加载在当前侧栏，已跳过');
    const pid=projectFor(a)||data.projectChats?.[id];
    const title=chatTitle(a);
    const scanned=scanSnapshot.items.get(id);
    if(title!==scanned.title||projectFor(a)!==scanned.projectId)throw Error('聊天标题或项目归属已变化，请重新获取');
    const words=(data.keywords||'').split(/[,，\n]/).map(s=>s.trim().toLocaleLowerCase()).filter(Boolean);
    if(data.whitelist?.[id]||(mode==='candidates'&&(words.some(w=>title.toLocaleLowerCase().includes(w))||(pid&&(data.projectChatOverrides?.[id]??!data.excludedProjects?.[pid])))))throw Error('此聊天目前受白名单或项目规则保护，已跳过');
    if(await deleteViaApi(id)){
      deletedInTab.add(id);
      const liveAnchor=findAnchor(id);
      if(liveAnchor){
        const liveRow=conversationRow(liveAnchor,id);
        if(liveRow&&liveRow!==document.body)liveRow.remove();
      }
      scanSnapshot.items.delete(id);
      return {ok:true,id,title};
    }
    a.scrollIntoView({block:'center'});
    await new Promise(resolve=>setTimeout(resolve,120));
    const current=findAnchor(id);if(!current)throw Error('聊天滚动后未加载在当前侧栏，已跳过');
    const row=conversationRow(current,id);
    if(!row)throw Error('未找到该聊天对应的侧栏行，已跳过');
    row.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    row.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
    row.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
    const box=current.getBoundingClientRect(),x=box.left+Math.min(box.width-2,Math.max(2,box.width*.7)),y=box.top+box.height/2;
    const hit=document.elementFromPoint(x,y)||current;
    hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y,pointerType:'mouse'}));
    hit.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:x,clientY:y}));
    const menu=await waitFor(()=>rowMenuButton(row,title,id),3500).catch(()=>{throw Error('已找到聊天行，但 ChatGPT 没有提供可定位的“对话选项”按钮。本条未执行删除；请确认聊天在侧栏中可见后重试');});
    if([...document.querySelectorAll('[role="menu"],[role="dialog"],[role="alertdialog"]')].some(visible))throw Error('页面上已有菜单或对话框，请关闭后重新获取');
    nativeClick(menu);
    const choice=await waitFor(()=>{const options=[...document.querySelectorAll('[role="menuitem"], [data-radix-collection-item], [role="menu"] button')].filter(visible).filter(el=>exactText(el,['删除','Delete','删除聊天','Delete chat']));return options.length===1?options[0]:null;});
    nativeClick(choice);
    const confirm=await waitFor(()=>{const direct=document.querySelector('[data-testid="delete-conversation-confirm-button"]');if(direct&&visible(direct))return direct;const dialog=[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(visible);if(!dialog)return null;const buttons=[...dialog.querySelectorAll('button,[role="button"]')].filter(visible).filter(el=>exactText(el,['删除','Delete','删除聊天','Delete chat']));return buttons.length===1?buttons[0]:null;});
    nativeClick(confirm);
    await waitFor(()=>!findAnchor(id),6000).catch(()=>{throw Error('点击确认后聊天仍在列表中，结果未确认');});
    deletedInTab.add(id);
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
        if(area>0&&intersection/area>=0.3){const title=chatTitle(a);if(title)picks.push({id,title,url:a.href,project:isProject(a),projectId:projectFor(a)});}
      }
      cleanup();const data=await storageGet(['whitelist']);const whitelist=data.whitelist||{};
      for(const c of picks)whitelist[c.id]={title:c.title,url:c.url,createdAt:new Date().toISOString()};
      await storageSet({whitelist});notify(`成功保护 ${new Set(picks.map(c=>c.id)).size} 条聊天（仅当前屏幕）`);
    });
  }
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg.type==='SCAN'){scanAll().then(result=>{startLiveWatching();sendResponse(result);}).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='PROJECTS'){sendResponse({projects:getProjects(),project:currentProject()});return;}
    if(msg.type==='MOVE_ONE'){moveOne(msg.id,msg.title,msg.scanToken,msg.targetProjectId).then(sendResponse).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='CREATE_PROJECT'){createProject(msg.title).then(sendResponse).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='DELETE_ONE'){deleteOne(msg.id,msg.scanToken,msg.mode).then(sendResponse).catch(error=>sendResponse({error:error.message}));return true;}
    if(msg.type==='FRAME'){selectRectangle();sendResponse({ok:true});return;}
    if(msg.type==='HIGHLIGHT'){
      const a=findAnchor(msg.id);if(a){a.scrollIntoView({block:'center'});a.style.outline='2px solid #1677ff';setTimeout(()=>a.style.outline='',2000);sendResponse({ok:true});}else sendResponse({ok:false});return;
    }
  });
})();
