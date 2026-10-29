import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = name => readFileSync(new URL(`../extension/${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.action.default_popup, 'popup.html');
assert(manifest.content_scripts.some(s => s.js.includes('content.js')));
for (const file of ['content.js', 'popup.js']) {
  execFileSync(process.execPath, ['--check', new URL(`../extension/${file}`, import.meta.url).pathname]);
}
for (const id of ['scan','frame','keywords','saveWords','stats','count','list','status','export','reset']) {
  assert(read('popup.html').includes(`id="${id}"`), `missing UI control ${id}`);
}
assert(!/chrome\.downloads|\bDELETE\b|fetch\(/.test(read('popup.js') + read('content.js')),
  'Preview build should not contain request/delete execution code');
console.log('PASS: manifest, JavaScript syntax, popup controls, preview safety checks');
