import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
assert.equal(manifest.manifest_version, 3);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version_name, manifest.version);
assert.equal(packageJson.version, `${manifest.version}-dev`);
assert.match(workflow, /push:\s+tags:\s+- 'v\*'/, 'release must be tag-triggered');
assert(!/paths(?:-ignore)?:/.test(workflow), 'tag-only release must not use unsupported path filters');
assert.match(workflow, /^permissions:\s+contents: read$/m, 'workflow default permission must be read-only');
assert.match(workflow, /jobs:\s+release:[\s\S]*?permissions:\s+contents: write/, 'only the release job may write release contents');
assert(workflow.includes('persist-credentials: false'), 'checkout must not persist the write-capable token');
assert(workflow.includes('find . -type f -print0 | LC_ALL=C sort -z'), 'release ZIP entries must have stable ordering');
assert(workflow.includes('--clobber'), 'reruns must replace assets for the same release tag');
assert(workflow.includes('manifest.version_name = version'), 'release package must remove the development label');
assert.match(workflow, /\^v\(\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\)\$/, 'release tags must use three-part semantic versions');
assert.match(workflow, /cleanup-history:[\s\S]*?needs: release[\s\S]*?if: \$\{\{ always\(\) && needs\.release\.result == 'success' \}\}/, 'run-history cleanup must only follow a successful release');
assert.match(workflow, /cleanup-history:[\s\S]*?continue-on-error: true[\s\S]*?permissions:\s+actions: write\s+contents: read/, 'cleanup must be non-blocking and use scoped permissions');
assert(workflow.includes('CURRENT_RUN_ID: ${{ github.run_id }}'), 'cleanup must preserve the current run');
assert(workflow.includes('actions/workflows/$workflow_id/runs?per_page=100'), 'cleanup must only query runs of this workflow');
assert(workflow.includes('--method DELETE "repos/$REPOSITORY/actions/runs/$run_id"'), 'cleanup must delete older workflow runs');
assert(manifest.permissions.includes('scripting'));
assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*', 'https://chat.openai.com/*']);
assert.equal(manifest.action.default_popup, 'popup.html');
assert(manifest.content_scripts.some(s => s.js.includes('content.js')));
for (const file of ['content.js', 'popup.js', 'screenshot.js']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(`../extension/${file}`, import.meta.url))]);
}
for (const id of ['scan','resizePopup','screenshot','screenshotPanel','whitelistToggle','whitelistList','protectProject','projects','keywords','saveWords','stats','count','chatSearch','clearChatSearch','list','status','export','reset','moveModeToggle','moveSelectionSummary','moveToolbar','selectMovePage','selectMoveMatches','clearMoveSelection','bulkAction','projectMoveOptions','moveTarget','showProjectCreate','projectCreateForm','newProjectName','createProject','cancelCreateProject','moveStart','moveStop','moveStatus','pageSize','pageSummary','pageInput','pageTotal','firstPage','prevPage','nextPage','lastPage','deleteArea','deletePreview','deleteConfirm','deleteStart','deleteStop','deleteProgress','deleteMode','deleteCount','saveDelete']) {
  assert(read('popup.html').includes(`id="${id}"`), `missing UI control ${id}`);
}
assert(read('popup.html').includes('全选本页'), 'chat list must offer one-click selection for the current page');
assert(read('popup.html').includes('全选搜索结果'), 'chat list must offer one-click selection for all search results');
assert(read('popup.html').includes('加入保护清单') && read('popup.html').includes('加入待删除'), 'bulk selection must support protection and pending deletion');
assert(read('popup.js').includes('async function protectSelectedChats()'), 'bulk selection must add chats to the protection list');
assert(read('popup.js').includes('async function queueSelectedChatsForDeletion()'), 'bulk selection must add chats to the pending deletion list');
assert(read('popup.js').includes('filteredChats().slice((page-1)*pageSize,page*pageSize)'), 'current-page project selection must be supported');
assert(read('popup.js').includes("for(const chat of filteredChats())moveSelection[chat.id]=chat.title"), 'all matching project selection must be supported');
assert(read('content.js').includes("(anchor.innerText||anchor.textContent||'').split(/\\r?\\n/).map(normTitle).find(Boolean)"), 'chat scanning must use the title line and omit the preview text');
assert(read('popup.js').includes("operation==='__remove_from_project__'"), 'moving chats out of projects must require an explicit choice');
assert(read('popup.js').includes("!select.value"), 'project organize action must stay disabled until a target is chosen');
assert(read('content.js').includes("msg.type==='DELETE_ONE'"));
assert(read('content.js').includes("msg.type==='MOVE_ONE'"));
assert(read('content.js').includes("msg.type==='CREATE_PROJECT'"));
assert(read('content.js').includes('无法从侧栏确认归属变化'));
assert(read('content.js').includes("type:'LIVE_CHATS'"));
assert(read('popup.js').includes('scanToken'));
assert(read('popup.js').includes('deleteSelection'));
assert(read('content.js').includes("mode==='candidates'"));
assert(read('popup.js').includes('getCurrentScannedChats'));
assert(!read('screenshot.js').includes("get(['scan'])"));
const content = read('content.js');
assert(content.includes("fetch('/api/auth/session'"), 'deletion must use the current ChatGPT session');
assert(content.includes('fetch(`/backend-api/conversation/${encodeURIComponent(id)}`'), 'deletion must target the selected conversation ID');
assert(content.includes("method:'PATCH'"));
assert(content.includes('JSON.stringify({is_visible:false})'));
assert(content.includes('result?.success!==true'), 'deletion must require explicit server confirmation');
assert.ok(content.indexOf('if(data.whitelist?.[id]') < content.indexOf('if(await deleteViaApi(id))'), 'whitelist checks must run before a delete request');
assert(content.includes('nativeClick(menu)'), 'keep UI deletion fallback');
assert(!/fetch\(/.test(read('popup.js') + read('screenshot.js')), 'popup and OCR must not make network requests');
for (const id of ['file','canvas','recognize','results','save']) {
  assert(read('popup.html').includes(`id="${id}"`), `missing screenshot control ${id}`);
}
assert(!/chrome\.tabs\.create|target=['"]_blank/.test(read('popup.js') + read('popup.html') + read('screenshot.js')),
  'All extension flows must stay in the popup');
assert(read('popup.html').includes('data-resize="bottom-right"'));
assert(read('popup.js').includes('setPointerCapture'));
for (const file of ['tesseract.min.js','worker.min.js','chi_sim.traineddata.gz','eng.traineddata.gz']) {
  assert(readFileSync(new URL(`../extension/ocr/${file}`, import.meta.url)).length > 1000, `missing local OCR asset ${file}`);
}
console.log('PASS: manifest/version, release trigger, JavaScript syntax, popup controls, deletion guards');
