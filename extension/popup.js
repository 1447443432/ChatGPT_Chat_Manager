const $ = id=>document.getElementById(id);
let chats=[];let projects=[];let currentPageProject=null;let whitelist={};let keywords='';let protectedProjects={};let excludedProjects={};let projectChats={};let projectChatDetails={};let projectChatOverrides={};let projectNames={};let expandedProjects=new Set();
let deleteSelection={},moveSelection={},moveMode=false,moving=false,stopMoving=false;
window.getCurrentScannedChats=()=>chats;
window.addDeleteSelections=items=>{const result={added:0,already:0,protected:0,stale:0};for(const c of items){const current=chats.find(x=>x.id===c.id&&x.title===c.title);if(!scanToken||!current){result.stale++;continue;}if(whitelist[c.id]){result.protected++;continue;}if(deleteSelection[c.id]===c.title){result.already++;continue;}deleteSelection[c.id]=c.title;result.added++;}render();return result;};
let page=1,pageSize=10,scanToken=null,deleting=false,stopDeletion=false,scanning=false;
const get = keys=>new Promise(resolve=>chrome.storage.local.get(keys,resolve));
const set = data=>new Promise(resolve=>chrome.storage.local.set(data,resolve));
const split = s=>s.split(/[,，\n]/).map(x=>x.trim().toLocaleLowerCase()).filter(Boolean);
const canonicalProjectId = id=>id?.match(/^g-p-[a-f0-9]{32}/i)?.[0]||id;
const status = s=>$('status').textContent=s;
$('versionLabel').textContent=`v${chrome.runtime.getManifest().version_name||chrome.runtime.getManifest().version}`;
chrome.runtime.onMessage.addListener(msg=>{
 if(msg.type!=='LIVE_CHATS'||!scanToken||msg.scanToken!==scanToken||scanning||deleting)return;
 const byId=new Map(chats.map(chat=>[chat.id,chat]));let added=0,changed=false;
 for(const chat of msg.chats||[]){const old=byId.get(chat.id);const merged={...old,...chat,projectId:chat.projectId||old?.projectId||null};if(!old)added++;if(!old||old.title!==merged.title||old.projectId!==merged.projectId){byId.set(chat.id,merged);changed=true;if(deleteSelection[chat.id]&&deleteSelection[chat.id]!==merged.title)delete deleteSelection[chat.id];if(merged.projectId){projectChats[chat.id]=merged.projectId;projectChatDetails[chat.id]={projectId:merged.projectId,title:merged.title,url:merged.url};protectedProjects[merged.projectId]||=merged.projectId;}}}
 if(!changed)return;
 chats=[...byId.values()];for(const project of msg.projects||[]){const index=projects.findIndex(item=>item.id===project.id);if(index<0)projects.push(project);else projects[index]=project;protectedProjects[project.id]=project.title;}
 void set({projects,projectChats,projectChatDetails,protectedProjects});render();if(added)status(`侧栏新加载了 ${added} 条聊天，当前共 ${chats.length} 条；列表已同步。`);
});
async function active(){const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];if(!tab||!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url||''))throw Error('请先打开 chatgpt.com 网页');return tab;}
async function send(type,arg={}){const tab=await active();try{return await chrome.tabs.sendMessage(tab.id,{type,...arg});}catch(error){if(!/Receiving end does not exist|Could not establish connection/i.test(error.message))throw error;await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});return chrome.tabs.sendMessage(tab.id,{type,...arg});}}
const projectProtected=(id,chatId)=>!!id&&(chatId&&projectChatOverrides[chatId]!==undefined?projectChatOverrides[chatId]:!excludedProjects[canonicalProjectId(id)]);
function protectedChat(c){return !!whitelist[c.id]||split(keywords).some(x=>c.title.toLocaleLowerCase().includes(x))||projectProtected(c.projectId||projectChats[c.id],c.id);}
function knownProjects(){const known=new Map(projects.map(p=>[p.id,p]));for(const [id,title] of Object.entries(protectedProjects))if(!known.has(id))known.set(id,{id,title});for(const id of Object.values(projectChats))if(id&&!known.has(id))known.set(id,{id,title:id});return known;}
function renderProjects(){
 const root=$('projects');root.replaceChildren();
 const known=knownProjects();
 const projectButton=$('protectProject');const currentKnown=!!currentPageProject&&known.has(currentPageProject.id);const currentChildren=Object.entries(projectChatDetails).filter(([,chat])=>chat.projectId===currentPageProject?.id);const currentProtected=!!currentPageProject&&!excludedProjects[canonicalProjectId(currentPageProject.id)]&&currentChildren.every(([id])=>projectChatOverrides[id]!==false);projectButton.hidden=!currentPageProject||(currentKnown&&currentProtected);projectButton.textContent=currentKnown?'恢复当前项目保护':'识别并保护当前项目';projectButton.title=currentKnown?'恢复此项目的保护并重新识别聊天':'补充识别当前项目并启用保护';
 for(const [id,project] of known){
  const children=Object.entries(projectChatDetails).filter(([,c])=>c.projectId===id).map(([chatId,c])=>({id:chatId,...c}));
  const title=projectNames[id]||project.title;const named=title&&title!==id;
  const row=document.createElement('div');row.className='chat projectRow';
  const toggle=document.createElement('button');toggle.className='treeToggle';toggle.textContent=expandedProjects.has(id)?'▾':'▸';toggle.setAttribute('aria-label',`${expandedProjects.has(id)?'收起':'展开'}项目 ${named?title:id}`);toggle.disabled=!children.length;toggle.addEventListener('click',()=>{if(expandedProjects.has(id))expandedProjects.delete(id);else expandedProjects.add(id);renderProjects();});
  const check=document.createElement('input');check.type='checkbox';check.checked=!excludedProjects[id]&&children.every(c=>projectProtected(id,c.id));check.indeterminate=children.some(c=>projectProtected(id,c.id))&&!check.checked;check.setAttribute('aria-label',`保护项目 ${named?title:id} 下的全部聊天`);
  check.addEventListener('change',async()=>{if(check.checked)delete excludedProjects[id];else excludedProjects[id]=true;for(const c of children)delete projectChatOverrides[c.id];await set({excludedProjects,projectChatOverrides});render();status(check.checked?'已保护整个项目':'已取消该项目的保护规则；手动白名单和关键词仍独立生效。');});
  const name=document.createElement('span');name.className='name';name.textContent=named?title:'未识别项目名称';name.title=id;
  const rename=document.createElement('button');rename.className='rename';rename.textContent=named?'改名':'设置名称';rename.addEventListener('click',()=>{const input=document.createElement('input');input.className='renameInput';input.value=named?title:'';name.replaceWith(input);input.focus();let done=false;const saveName=async()=>{if(done)return;done=true;const value=input.value.trim();if(value){projectNames[id]=value;await set({projectNames});}renderProjects();};input.addEventListener('keydown',e=>{if(e.key==='Enter')saveName();if(e.key==='Escape'){done=true;renderProjects();}});input.addEventListener('blur',saveName,{once:true});});
  const count=document.createElement('span');count.className='childCount';count.textContent=`${children.length} 条`;
  row.append(toggle,check,name,count,rename);root.append(row);
  if(expandedProjects.has(id))for(const c of children){const child=document.createElement('div');child.className='chat childRow';const childCheck=document.createElement('input');childCheck.type='checkbox';childCheck.checked=projectProtected(id,c.id);childCheck.setAttribute('aria-label',`保护聊天 ${c.title}`);childCheck.addEventListener('change',async()=>{projectChatOverrides[c.id]=childCheck.checked;await set({projectChatOverrides});render();});const childName=document.createElement('span');childName.className='name';childName.textContent=c.title||c.id;const pick=document.createElement('button');pick.className='pickDelete';pick.textContent=deleteSelection[c.id]?'取消待删除':'待删除';pick.disabled=!!whitelist[c.id]||!scanToken||!chats.some(x=>x.id===c.id&&x.title===c.title);pick.title=whitelist[c.id]?'请先移出手动白名单':pick.disabled?'请先重新获取当前聊天':'';pick.addEventListener('click',()=>toggleDelete(c));child.append(childCheck,childName,pick);root.append(child);}
 }
}
function renderProjectOrganizer(){
 const select=$('moveTarget'),previous=select.value;select.replaceChildren(new Option('选择目标项目或操作',''));
 select.add(new Option('移出项目（移回普通聊天）','__remove_from_project__'));
 const available=projects.filter(project=>project?.id);for(const project of available){const id=project.id,title=projectNames[id]||project.title||id;const duplicate=available.filter(item=>(projectNames[item.id]||item.title)===title).length>1;select.add(new Option(duplicate?`${title}（${id.slice(-8)}）`:title,id));}
 if([...select.options].some(option=>option.value===previous))select.value=previous;
 const selected=Object.entries(moveSelection).filter(([id,title])=>chats.some(chat=>chat.id===id&&chat.title===title));
 $('moveToolbar').hidden=!moveMode||!selected.length;
 $('projectMoveOptions').hidden=$('bulkAction').value!=='project';
 $('moveSelectionSummary').textContent=selected.length?`已选 ${selected.length} 条聊天`:'可全选本页或全部搜索结果';
 $('moveModeToggle').textContent=moveMode?'退出选择':'手动选择';
 $('moveModeToggle').setAttribute('aria-pressed',String(moveMode));
 $('selectMovePage').disabled=!scanToken||moving;
 $('selectMoveMatches').disabled=!scanToken||moving;
 $('clearMoveSelection').disabled=!selected.length||moving;
 const action=$('bulkAction').value;
 $('moveStart').textContent=action==='protect'?'加入保护清单':action==='delete'?'加入待删除':action==='project'?'执行整理':'执行操作';
 $('moveStart').disabled=!scanToken||!selected.length||!action||(action==='project'&&!select.value)||moving;
 $('moveStop').disabled=!moving;
 $('createProject').disabled=moving||!$('newProjectName').value.trim();
}
function render(){
 renderProjects();
 renderWhitelist();
 const keep=chats.filter(protectedChat).length;
 $('stats').textContent=`已扫描 ${chats.length} 条 · 保护 ${keep} 条 · 候选 ${chats.length-keep} 条`;
 $('count').textContent=chats.length;
 $('projectCount').textContent=knownProjects().size;
 const shown=filteredChats();const totalPages=Math.max(1,Math.ceil(shown.length/pageSize));page=Math.min(Math.max(1,page),totalPages);
 $('pageSize').value=pageSize;$('pageInput').value=page;$('pageInput').max=totalPages;
 $('pageSummary').textContent=shown.length===chats.length?`共 ${chats.length} 条`:`找到 ${shown.length}/${chats.length} 条`;
 $('pageTotal').textContent=`/ ${shown.length?totalPages:0} 页`;
 $('searchSummary').textContent=$('chatSearch').value.trim()?`${shown.length} 条`:'';
 $('clearChatSearch').hidden=!$('chatSearch').value;
 for(const id of ['firstPage','prevPage'])$(id).disabled=page<=1;
 for(const id of ['nextPage','lastPage'])$(id).disabled=page>=totalPages;
 const root=$('list');root.replaceChildren();
 if(!shown.length){const empty=document.createElement('div');empty.className='emptyList';empty.textContent=chats.length?'没有匹配的聊天，试试标题关键词或 ID':'暂无内容，请先扫描或添加';root.append(empty);}
 renderProjectOrganizer();
 for(const c of shown.slice((page-1)*pageSize,page*pageSize)){const row=document.createElement('div');row.className='chat';
 if(moveMode){const movePick=document.createElement('input');movePick.type='checkbox';movePick.className='projectMovePick';movePick.checked=moveSelection[c.id]===c.title;movePick.disabled=!scanToken||protectedChat(c);movePick.title=protectedChat(c)?'受保护聊天不能加入待删除':'选择整理项目';movePick.setAttribute('aria-label',`选择整理项目：${c.title}`);movePick.addEventListener('change',()=>{if(movePick.checked)moveSelection[c.id]=c.title;else delete moveSelection[c.id];render();});row.append(movePick);}
 const safe=protectedChat(c),projectId=c.projectId||projectChats[c.id];const protect=document.createElement('button');protect.type='button';protect.className='protectChat '+(safe?'isRuleProtected':'');protect.textContent=safe?'保护中':'保护';protect.title=safe?'请到保护清单中移除此聊天':'加入手动保护清单';protect.disabled=safe;protect.setAttribute('aria-pressed',String(safe));protect.addEventListener('click',async()=>{whitelist[c.id]={title:c.title,url:c.url,createdAt:new Date().toISOString()};delete deleteSelection[c.id];await set({whitelist});render();});
 const name=document.createElement('span');name.className='name';name.textContent=c.title;name.title=c.url;
 const mark=document.createElement('span');mark.className='mark '+(safe?'protected':'candidate');mark.textContent=projectId?(projectNames[canonicalProjectId(projectId)]||protectedProjects[projectId]||projects.find(p=>canonicalProjectId(p.id)===canonicalProjectId(projectId))?.title||'项目'):safe?'保留':'候选';if(projectId)mark.title=mark.textContent;
 const pick=document.createElement('button');pick.className='pickDelete';pick.textContent=deleteSelection[c.id]?'取消待删除':'待删除';pick.disabled=safe||!scanToken;pick.title=safe?'请先到保护清单中移除此聊天':pick.disabled?'请先重新获取当前聊天':'';pick.addEventListener('click',()=>toggleDelete(c));
 row.append(protect,name,mark,pick);root.append(row);
 }
 renderDelete();
}
function filteredChats(){const terms=$('chatSearch').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return terms.length?chats.filter(c=>{const haystack=`${c.title} ${c.id}`.toLocaleLowerCase();return terms.every(term=>haystack.includes(term));}):chats;}
function candidates(){return chats.filter(c=>!protectedChat(c));}
function toggleDelete(c){if(deleteSelection[c.id])delete deleteSelection[c.id];else if(!whitelist[c.id])deleteSelection[c.id]=c.title;render();}
async function moveSelectedChats(){
 const items=chats.filter(chat=>moveSelection[chat.id]===chat.title);if(!scanToken||!items.length||moving)return;
 const operation=$('moveTarget').value;if(!operation){$('moveStatus').textContent='请先选择目标项目，或明确选择“移出项目”。';return;}
 const targetId=operation==='__remove_from_project__'?null:operation;const target=targetId?knownProjects().get(targetId):null;
 if(targetId&&!target){$('moveStatus').textContent='目标项目已不在当前列表，请重新获取后再试。';return;}
 const actionable=items.filter(chat=>(chat.projectId||projectChats[chat.id]||null)!==targetId);
 if(!actionable.length){$('moveStatus').textContent='所选聊天已在目标位置，无需移动。';return;}
 const targetName=target?(projectNames[targetId]||target.title):'普通聊天列表';
 const preview=actionable.slice(0,8).map(chat=>`· ${chat.title}`).join('\n');
 const protectedAffected=actionable.some(chat=>projectProtected(chat.projectId||projectChats[chat.id],chat.id)&&!targetId);
 const warning=protectedAffected?'\n移出项目后，这些聊天将不再受原项目保护；手动白名单和关键词保护仍有效。':'';
 const actionText=targetId?'移动到':'移出项目并移回普通聊天';
 if(!confirm(`确认${actionText} ${actionable.length} 条聊天${targetId?`至「${targetName}」`:''}？\n\n${preview}${actionable.length>8?`\n…另有 ${actionable.length-8} 条`:''}${warning}\n\n操作将逐条执行；遇到无法确认的结果会停止。`))return;
 moving=true;stopMoving=false;renderProjectOrganizer();let done=0,failed='';
 for(const chat of actionable){if(stopMoving)break;$('moveStatus').textContent=`正在处理 ${done+1}/${actionable.length}：${chat.title}`;
  try{const result=await send('MOVE_ONE',{id:chat.id,title:chat.title,scanToken,targetProjectId:targetId});if(result.error)throw Error(result.error);
   const current=chats.find(item=>item.id===chat.id);if(current){current.projectId=targetId;current.project=!!targetId;}
   if(targetId){projectChats[chat.id]=targetId;projectChatDetails[chat.id]={projectId:targetId,title:chat.title,url:chat.url};protectedProjects[targetId]||=targetName;}else{delete projectChats[chat.id];delete projectChatDetails[chat.id];}
   delete projectChatOverrides[chat.id];delete moveSelection[chat.id];await set({projectChats,projectChatDetails,protectedProjects,projectChatOverrides});done++;render();
  }catch(error){failed=`${chat.title}：${error.message}`;break;}
  await new Promise(resolve=>setTimeout(resolve,450));
 }
 moving=false;render();$('moveStatus').textContent=`已确认移动 ${done}/${actionable.length} 条${stopMoving?'，已停止':''}${failed?`；未完成：${failed}（保留在选择中）`:''}`;status($('moveStatus').textContent);
 if(done){try{const result=await send('PROJECTS');for(const project of result.projects||[]){if(!projects.some(item=>item.id===project.id))projects.push(project);protectedProjects[project.id]=project.title;}await set({projects,protectedProjects});render();}catch{/* 已按页面结果确认，刷新名称失败时保留本地结果 */}}
}
async function protectSelectedChats(){
 const items=chats.filter(chat=>moveSelection[chat.id]===chat.title);if(!scanToken||!items.length)return;
 let added=0;for(const chat of items){if(whitelist[chat.id])continue;whitelist[chat.id]={title:chat.title,url:chat.url,createdAt:new Date().toISOString()};delete deleteSelection[chat.id];added++;}
 await set({whitelist});render();const message=`已加入保护清单 ${added} 条${items.length>added?`，${items.length-added} 条原已受手动保护`:''}。`;status(message);$('moveStatus').textContent=message;
}
async function queueSelectedChatsForDeletion(){
 const items=chats.filter(chat=>moveSelection[chat.id]===chat.title);if(!scanToken||!items.length)return;
 let added=0,protectedCount=0;for(const chat of items){if(protectedChat(chat)){protectedCount++;continue;}if(deleteSelection[chat.id]===chat.title)continue;deleteSelection[chat.id]=chat.title;added++;}
 render();const message=`已加入待删除 ${added} 条${protectedCount?`，跳过保护清单中的 ${protectedCount} 条`:''}。如需删除受保护聊天，请先移除保护，再重新选择。`;status(message);$('moveStatus').textContent=message;
}
async function executeBulkAction(){const action=$('bulkAction').value;if(action==='protect')return protectSelectedChats();if(action==='delete')return queueSelectedChatsForDeletion();if(action==='project')return moveSelectedChats();}
function deleteItems(){return $('deleteMode').value==='selected'?chats.filter(c=>deleteSelection[c.id]===c.title&&!whitelist[c.id]):candidates();}
function renderDelete(){const items=deleteItems(),ready=!!scanToken,selected=$('deleteMode').value==='selected';$('deleteCount').textContent=Object.keys(deleteSelection).length;$('deleteListLabel').textContent=selected?'待删除名单：仅处理你逐条选中的聊天':'非保护候选：本次扫描中未命中保护规则的聊天';$('deleteListTotal').textContent=ready?`共 ${items.length} 条`:'尚未获取';$('deleteHint').textContent=ready?selected?'指定删除可覆盖关键词和项目保护；手动白名单仍会阻止删除。名单只在当前弹窗有效。':'将删除所有未命中手动白名单、关键词和项目保护的候选聊天。':'请先点击“清缓存并重新获取”，再选择聊天并核对名单。';const root=$('deletePreview');root.replaceChildren();if(ready&&items.length)for(const c of items){const row=document.createElement('div');row.className='chat';const name=document.createElement('span');name.className='name';name.textContent=c.title;const remove=document.createElement('button');remove.textContent='移除';remove.hidden=!selected;remove.addEventListener('click',()=>toggleDelete(c));row.append(name,remove);row.title=c.url;root.append(row);}else{const empty=document.createElement('div');empty.className='emptyList';empty.textContent=ready?selected?'名单为空。请在聊天列表或截图识别中添加。':'当前没有非保护候选。':'扫描后显示聊天名单。';root.append(empty);}$('deleteStart').disabled=!ready||!items.length||deleting||!$('deleteConfirm').checked;$('deleteStop').disabled=!deleting;}
function renderWhitelist(){
 const entries=new Map(Object.entries(whitelist).map(([id,chat])=>[id,{id,title:chat.title||id,manual:true}]));
 for(const c of chats)if(protectedChat(c)){const projectId=c.projectId||projectChats[c.id];entries.set(c.id,{id:c.id,title:c.title,manual:!!whitelist[c.id],project:projectProtected(projectId,c.id),projectTitle:projectId&&(projectNames[canonicalProjectId(projectId)]||protectedProjects[projectId]||projects.find(p=>canonicalProjectId(p.id)===canonicalProjectId(projectId))?.title),keyword:split(keywords).some(w=>c.title.toLocaleLowerCase().includes(w))});}
 $('whitelistCount').textContent=entries.size;
 $('reset').disabled=!Object.keys(whitelist).length;
 const root=$('whitelistList');root.replaceChildren();
 for(const [id,chat] of entries){const row=document.createElement('div');row.className='chat whitelistRow';const name=document.createElement('span');name.className='name';name.textContent=chat.title||id;name.title=`${chat.title||id}\n${id}`;const sources=[chat.manual&&'手动',chat.keyword&&'关键词',chat.project&&(chat.projectTitle?`项目：${chat.projectTitle}`:'项目')].filter(Boolean);const source=document.createElement('span');source.className='mark protected whitelistSource';source.textContent=sources.join(' · ')||'手动';source.title=sources.join(' · ');if(chat.manual){const remove=document.createElement('button');remove.className='removeManual';remove.textContent='取消保护';remove.setAttribute('aria-label',`从手动保护清单移除 ${chat.title}`);remove.addEventListener('click',async()=>{delete whitelist[id];await set({whitelist});render();});row.append(name,source,remove);}else{row.append(name,source);}root.append(row);}
}
function openPanel(id){for(const panel of document.querySelectorAll('.panel'))panel.hidden=panel.id!==id;for(const tab of document.querySelectorAll('.tab')){const active=tab.dataset.panel===id;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));}if(id==='projectsPanel')refreshProjectNames();}
async function refreshProjectNames(){try{const r=await send('PROJECTS');currentPageProject=r.project||null;if(r.projects?.length){const known=knownProjects();for(const p of r.projects){known.set(p.id,p);protectedProjects[p.id]=p.title;}projects=[...known.values()];await set({projects,protectedProjects});}render();if(r.projects?.length)status(`已更新 ${r.projects.length} 个项目名称。`);}catch{/* 当前标签页不是 ChatGPT 时保留上次结果 */}}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>openPanel(tab.dataset.panel)));
$('moveModeToggle').addEventListener('click',()=>{moveMode=!moveMode;render();});
$('selectMovePage').addEventListener('click',()=>{if(!scanToken)return;moveMode=true;for(const chat of filteredChats().slice((page-1)*pageSize,page*pageSize))moveSelection[chat.id]=chat.title;render();});
$('selectMoveMatches').addEventListener('click',()=>{if(!scanToken)return;moveMode=true;for(const chat of filteredChats())moveSelection[chat.id]=chat.title;render();});
$('clearMoveSelection').addEventListener('click',()=>{moveSelection={};render();});
$('bulkAction').addEventListener('change',()=>{renderProjectOrganizer();});
$('moveTarget').addEventListener('change',()=>{renderProjectOrganizer();});
$('newProjectName').addEventListener('input',()=>{renderProjectOrganizer();});
$('showProjectCreate').addEventListener('click',()=>{$('projectCreateForm').hidden=false;$('showProjectCreate').hidden=true;$('newProjectName').focus();});
$('cancelCreateProject').addEventListener('click',()=>{$('newProjectName').value='';$('projectCreateForm').hidden=true;$('showProjectCreate').hidden=false;renderProjectOrganizer();});
$('createProject').addEventListener('click',async()=>{const title=$('newProjectName').value.trim();if(!title||moving)return;$('createProject').disabled=true;$('moveStatus').textContent=`正在 ChatGPT 中创建项目「${title}」…`;try{const result=await send('CREATE_PROJECT',{title});if(result.error)throw Error(result.error);const project=result.project;if(!project?.id)throw Error('ChatGPT 未返回可核对的项目，请检查侧栏后重新获取');projects=projects.filter(item=>item.id!==project.id);projects.push(project);protectedProjects[project.id]=project.title;await set({projects,protectedProjects});$('newProjectName').value='';$('projectCreateForm').hidden=true;$('showProjectCreate').hidden=false;$('bulkAction').value='project';$('moveTarget').value=project.id;render();$('moveStatus').textContent=`项目「${project.title}」已创建，并已选为整理目标。`;}catch(error){$('moveStatus').textContent=`创建失败：${error.message}`;renderProjectOrganizer();}});
$('moveStart').addEventListener('click',executeBulkAction);
$('moveStop').addEventListener('click',()=>{stopMoving=true;$('moveStatus').textContent='正在停止，当前聊天完成后停止。';});
const changePage=next=>{page=Math.min(Math.max(1,Math.trunc(next)),Math.max(1,Math.ceil(filteredChats().length/pageSize)));render();$('list').scrollTop=0;};
$('chatSearch').addEventListener('input',()=>{page=1;render();});
$('clearChatSearch').addEventListener('click',()=>{$('chatSearch').value='';page=1;render();$('chatSearch').focus();});
$('firstPage').addEventListener('click',()=>changePage(1));$('prevPage').addEventListener('click',()=>changePage(page-1));$('nextPage').addEventListener('click',()=>changePage(page+1));$('lastPage').addEventListener('click',()=>changePage(Math.ceil(filteredChats().length/pageSize)));
$('pageInput').addEventListener('change',()=>changePage(Number($('pageInput').value)||1));
$('pageSize').addEventListener('change',async()=>{pageSize=Math.min(100,Math.max(1,Math.trunc(Number($('pageSize').value)||10)));page=1;await set({pageSize});render();});
async function scan(clearCache=true){if(deleting||scanning)return;scanning=true;$('scan').disabled=true;scanToken=null;chats=[];projects=[];projectChats={};projectChatDetails={};protectedProjects={};page=1;$('deleteConfirm').checked=false;try{if(clearCache)await new Promise(resolve=>chrome.storage.local.remove(['scan','projects','scanAt','projectChats','projectChatDetails','protectedProjects'],resolve));render();status('正在读取当前 ChatGPT 页面的真实聊天…');let r=await send('SCAN');for(let attempt=0;attempt<2&&!r.error&&!r.chats?.length;attempt++){status('页面聊天列表还在加载，正在重试扫描…');await new Promise(resolve=>setTimeout(resolve,900));r=await send('SCAN');}if(r.error)throw Error(r.error);chats=r.chats||[];currentPageProject=r.project||null;deleteSelection=Object.fromEntries(Object.entries(deleteSelection).filter(([id,title])=>chats.some(c=>c.id===id&&c.title===title)&&!whitelist[id]));projects=r.projects||[];scanToken=r.scanToken;for(const p of projects)protectedProjects[p.id]=p.title;for(const c of chats)if(c.projectId){projectChats[c.id]=c.projectId;projectChatDetails[c.id]={projectId:c.projectId,title:c.title,url:c.url};protectedProjects[c.projectId] ||= c.projectId;}await set({projects,projectChats,projectChatDetails,protectedProjects});render();status(chats.length?`扫描完成：${chats.length} 条聊天、${knownProjects().size} 个项目。${r.truncated?'列表可能还有更多内容。':'历史记录可能仍有遗漏。'}`:'页面当前没有可识别的聊天；可稍后点“重新获取”。');}catch(e){status(e.message+'；请刷新 ChatGPT 页面后再试。');}finally{scanning=false;$('scan').disabled=false;}}
 $('scan').addEventListener('click',()=>scan(true));
$('deleteConfirm').addEventListener('change',renderDelete);
$('deleteMode').addEventListener('change',()=>{$('deleteConfirm').checked=false;renderDelete();});
$('deleteClear').addEventListener('click',()=>{if(deleting)return;deleteSelection={};$('deleteMode').value='selected';$('deleteConfirm').checked=false;render();status('已清空待删除名单。');});
$('deleteStop').addEventListener('click',()=>{stopDeletion=true;$('deleteProgress').textContent='正在停止，当前聊天处理完后结束。';});
$('deleteStart').addEventListener('click',async()=>{const mode=$('deleteMode').value,items=deleteItems();if(!scanToken||!items.length||!$('deleteConfirm').checked)return;deleting=true;stopDeletion=false;renderDelete();let done=0,skipped=0;const skipReasons=[];for(const c of items){if(stopDeletion)break;if((mode==='selected'&&(deleteSelection[c.id]!==c.title||whitelist[c.id]))||(mode==='candidates'&&protectedChat(c))){skipped++;skipReasons.push(`${c.title}：保护规则已变化`);continue;}$('deleteProgress').textContent=`正在处理 ${done+skipped+1}/${items.length}：${c.title}`;try{const result=await send('DELETE_ONE',{id:c.id,scanToken,mode});if(result.error)throw Error(result.error);chats=chats.filter(x=>x.id!==c.id);delete deleteSelection[c.id];done++;render();}catch(e){skipped++;skipReasons.push(`${c.title}：${e.message}`);$('deleteProgress').textContent=`已跳过「${c.title}」：${e.message}`;if(!/未加载在当前侧栏|受白名单或项目规则保护/.test(e.message))break;}await new Promise(resolve=>setTimeout(resolve,600));}deleting=false;scanToken=null;$('deleteConfirm').checked=false;render();$('deleteProgress').textContent=`正在同步 ChatGPT 列表…（ChatGPT 已确认删除 ${done} 条，未完成 ${skipped} 条）`;await scan(true);const summary=`处理完成：ChatGPT 已确认删除 ${done} 条，未完成 ${skipped} 条；当前扫描到 ${chats.length} 条聊天。${stopDeletion?'已按要求停止。':''}${skipReasons.length?`未完成原因：${skipReasons.slice(0,3).join('；')}${skipReasons.length>3?'；另有 '+(skipReasons.length-3)+' 条':''}`:''}`;$('deleteProgress').textContent=summary;status(summary);});
$('protectProject').addEventListener('click',async()=>{if(deleting)return;scanToken=null;deleteSelection={};$('deleteConfirm').checked=false;try{status('正在读取当前项目…');const r=await send('SCAN');if(r.error)throw Error(r.error);if(!r.project)throw Error('请先打开要保护的项目主页');currentPageProject=r.project;protectedProjects[r.project.id]=r.project.title;delete excludedProjects[r.project.id];for(const c of r.chats)if(c.projectId===r.project.id){projectChats[c.id]=r.project.id;projectChatDetails[c.id]={projectId:r.project.id,title:c.title,url:c.url};delete projectChatOverrides[c.id];}await set({protectedProjects,excludedProjects,projectChats,projectChatDetails,projectChatOverrides});render();status(`已保护项目 ${r.project.title}；已识别 ${r.chats.filter(c=>c.projectId===r.project.id).length} 条聊天。删除前请重新获取。`);}catch(e){render();status(e.message);}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.whitelist){whitelist=changes.whitelist.newValue||{};for(const id of Object.keys(whitelist))delete deleteSelection[id];render();}});
$('saveWords').addEventListener('click',async()=>{keywords=$('keywords').value;await set({keywords});render();const matched=chats.filter(c=>split(keywords).some(w=>c.title.toLocaleLowerCase().includes(w))).length;status(chats.length?`关键词已保存；本次扫描匹配 ${matched} 条聊天。${matched?'':'当前未找到匹配，规则仍会用于下次扫描。'}`:'关键词已保存；请重新获取后检查匹配数量。');});
$('keywords').addEventListener('input',()=>{keywords=$('keywords').value;render();});
$('reset').addEventListener('click',async()=>{if(!confirm('确定清空所有手动白名单？关键词不受影响。'))return;whitelist={};await set({whitelist});render();});
$('export').addEventListener('click',()=>{const rows=[['id','标题','URL','是否保护','项目 ID','保护来源','指定待删除'],...chats.map(c=>[c.id,c.title,c.url,protectedChat(c)?'是':'否',c.projectId||projectChats[c.id]||'',whitelist[c.id]?'手动勾选/截图':projectProtected(c.projectId||projectChats[c.id],c.id)?'项目':split(keywords).some(w=>c.title.toLocaleLowerCase().includes(w))?'关键词':'无',deleteSelection[c.id]===c.title?'是':'否'])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='ChatGPT_聊天清单.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
function applyPopupSize(width,height){width=Math.min(780,Math.max(380,Math.round(width)));height=Math.min(600,Math.max(360,Math.round(height)));document.body.style.width=`${width}px`;document.body.style.height=`${height}px`;const expanded=width>=600;document.body.classList.toggle('expanded',expanded);$('resizePopup').textContent=expanded?'还原':'放大';$('resizePopup').setAttribute('aria-pressed',String(expanded));return {width,height};}
$('resizePopup').addEventListener('click',async()=>{const size=applyPopupSize(document.body.clientWidth>=600?430:650,document.body.clientWidth>=600?580:600);await set({popupSize:size});});
for(const handle of document.querySelectorAll('.resizeHandle')){let drag;handle.addEventListener('pointerdown',event=>{event.preventDefault();drag={x:event.screenX,y:event.screenY,width:document.body.clientWidth,height:document.body.clientHeight};handle.setPointerCapture(event.pointerId);document.body.style.userSelect='none';});handle.addEventListener('pointermove',event=>{if(!drag)return;const direction=handle.dataset.resize;const dx=event.screenX-drag.x,dy=event.screenY-drag.y;applyPopupSize(drag.width+(direction.includes('right')?dx:direction.includes('left')?-dx:0),drag.height+(direction.includes('bottom')?dy:direction.includes('top')?-dy:0));});const finish=async()=>{if(!drag)return;drag=null;document.body.style.userSelect='';await set({popupSize:{width:document.body.clientWidth,height:document.body.clientHeight}});};handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);}
(async()=>{const data=await get(['keywords','whitelist','excludedProjects','projectChatOverrides','projectNames','pageSize','popupSize','expanded']);keywords=data.keywords||'';whitelist=data.whitelist||{};excludedProjects=Object.fromEntries(Object.entries(data.excludedProjects||{}).map(([id,value])=>[canonicalProjectId(id),value]));projectChatOverrides=data.projectChatOverrides||{};projectNames=Object.fromEntries(Object.entries(data.projectNames||{}).map(([id,title])=>[canonicalProjectId(id),title]));pageSize=Math.min(100,Math.max(1,Math.trunc(Number(data.pageSize)||10)));if(data.popupSize)applyPopupSize(data.popupSize.width,data.popupSize.height);else if(data.expanded)applyPopupSize(650,600);$('keywords').value=keywords;await new Promise(resolve=>chrome.storage.local.remove(['scan','projects','scanAt','projectChats','projectChatDetails','protectedProjects'],resolve));render();scan(false);})();
