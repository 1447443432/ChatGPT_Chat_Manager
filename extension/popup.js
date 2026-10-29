const $ = id=>document.getElementById(id);
let chats=[];let whitelist={};let keywords='';
const get = keys=>new Promise(resolve=>chrome.storage.local.get(keys,resolve));
const set = data=>new Promise(resolve=>chrome.storage.local.set(data,resolve));
const split = s=>s.split(/[,，\n]/).map(x=>x.trim().toLocaleLowerCase()).filter(Boolean);
const status = s=>$('status').textContent=s;
async function active(){const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];if(!tab||!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url||''))throw Error('请先打开 chatgpt.com 网页');return tab;}
async function send(type,arg={}){const tab=await active();return chrome.tabs.sendMessage(tab.id,{type,...arg});}
function protectedChat(c){return !!whitelist[c.id]||split(keywords).some(x=>c.title.toLocaleLowerCase().includes(x))||c.project;}
function render(){
 const keep=chats.filter(protectedChat).length;
 $('stats').textContent=`已扫描 ${chats.length} 条 ｜保护 ${keep} 条 ｜候选 ${chats.length-keep} 条`;
 $('count').textContent=`(${chats.length})`;
 const root=$('list');root.replaceChildren();
 for(const c of chats){const row=document.createElement('div');row.className='chat';
 const check=document.createElement('input');check.type='checkbox';check.checked=!!whitelist[c.id];check.title='手动强制保护';check.addEventListener('change',async()=>{if(check.checked)whitelist[c.id]={title:c.title,url:c.url,createdAt:new Date().toISOString()};else delete whitelist[c.id];await set({whitelist});render();});
 const name=document.createElement('span');name.className='name';name.textContent=c.title;name.title=c.url;
 const mark=document.createElement('span');const safe=protectedChat(c);mark.className='mark '+(safe?'protected':'candidate');mark.textContent=c.project?'项目保护':safe?'保留':'候选';
 row.append(check,name,mark);row.addEventListener('dblclick',()=>send('HIGHLIGHT',{id:c.id}).catch(e=>status(e.message)));root.append(row);
 }
}
async function scan(){try{const r=await send('SCAN');chats=r.chats;await set({scan:chats,scanAt:new Date().toISOString()});render();status('扫描完成；仅包含当前已加载的可见聊天。滚动加载后需重新扫描。');}catch(e){status(e.message+'；请刷新 ChatGPT 页面后再试。');}}
$('scan').addEventListener('click',scan);
$('frame').addEventListener('click',async()=>{try{await send('FRAME');window.close();}catch(e){status(e.message);}});
$('saveWords').addEventListener('click',async()=>{keywords=$('keywords').value;await set({keywords});render();status('关键词已保存');});
$('keywords').addEventListener('input',()=>{keywords=$('keywords').value;render();});
$('reset').addEventListener('click',async()=>{if(!confirm('确定清空所有手动白名单？关键词不受影响。'))return;whitelist={};await set({whitelist});render();});
$('export').addEventListener('click',()=>{const rows=[['id','标题','URL','是否保护','是否项目','保护来源'],...chats.map(c=>[c.id,c.title,c.url,protectedChat(c)?'是':'否',c.project?'是':'否',whitelist[c.id]?'手动框选/勾选':c.project?'项目':split(keywords).some(w=>c.title.toLocaleLowerCase().includes(w))?'关键词':'无'])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='ChatGPT_聊天白名单预览.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
(async()=>{const data=await get(['keywords','whitelist','scan']);keywords=data.keywords||'';whitelist=data.whitelist||{};chats=data.scan||[];$('keywords').value=keywords;render();})();
