import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert(manifest.version.split('.').length <= 4 && manifest.version.split('.').every(n => /^\d+$/.test(n) && Number(n) <= 65535));
assert.match(manifest.version_name, /^\d+\.\d+\.\d+\.\d{11}$/);
assert(manifest.permissions.includes('scripting'));
assert.equal(manifest.action.default_popup, 'popup.html');
assert(manifest.content_scripts.some(s => s.js.includes('content.js')));
for (const file of ['content.js', 'popup.js', 'screenshot.js']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(`../extension/${file}`, import.meta.url))]);
}
for (const id of ['scan','resizePopup','screenshot','screenshotPanel','whitelistToggle','whitelistList','protectProject','projects','keywords','saveWords','stats','count','list','status','export','reset','pageSize','pageInput','firstPage','prevPage','nextPage','lastPage','deleteArea','deletePreview','deletePhrase','deleteStart','deleteStop','deleteProgress','deleteMode','deleteCount','saveDelete']) {
  assert(read('popup.html').includes(`id="${id}"`), `missing UI control ${id}`);
}
assert(read('content.js').includes("msg.type==='DELETE_ONE'"));
assert(read('popup.js').includes('scanToken'));
assert(read('popup.js').includes('deleteSelection'));
assert(read('content.js').includes("mode==='candidates'"));
assert(read('popup.js').includes('getCurrentScannedChats'));
assert(!read('screenshot.js').includes("get(['scan'])"));
assert(!/fetch\(/.test(read('popup.js') + read('content.js')),
  'Deletion should use the ChatGPT page controls');
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
