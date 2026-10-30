import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.0.0');
assert.equal(manifest.version_name, '1.0.0');
assert.equal(packageJson.version, manifest.version);
assert(manifest.permissions.includes('scripting'));
assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*', 'https://chat.openai.com/*']);
assert.equal(manifest.action.default_popup, 'popup.html');
assert(manifest.content_scripts.some(s => s.js.includes('content.js')));
for (const file of ['content.js', 'popup.js', 'screenshot.js']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(`../extension/${file}`, import.meta.url))]);
}
for (const id of ['scan','resizePopup','screenshot','screenshotPanel','whitelistToggle','whitelistList','protectProject','projects','keywords','saveWords','stats','count','chatSearch','clearChatSearch','list','status','export','reset','pageSize','pageSummary','pageInput','pageTotal','firstPage','prevPage','nextPage','lastPage','deleteArea','deletePreview','deleteConfirm','deleteStart','deleteStop','deleteProgress','deleteMode','deleteCount','saveDelete']) {
  assert(read('popup.html').includes(`id="${id}"`), `missing UI control ${id}`);
}
assert(read('content.js').includes("msg.type==='DELETE_ONE'"));
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
console.log('PASS: manifest, JavaScript syntax, popup controls, deletion guards');
