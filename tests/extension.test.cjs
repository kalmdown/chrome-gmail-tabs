const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
function setup(local = {}, sync = {}) {
  const area = data => ({
    async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => data[k] !== undefined).map(k => [k, data[k]])); },
    async set(values) { Object.assign(data, values); },
    async remove(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]; }
  });
  const logs = [];
  const ctx = vm.createContext({ console: { info: x => logs.push(x), error: x => logs.push(x) },
    chrome: { runtime: { getManifest: () => manifest }, storage: { local: area(local), sync: area(sync) } } });
  const run = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  run('version.js');
  return { ctx, run, logs, local, sync };
}
test('Gmail filters preserve encoded queries and quote nested labels', () => {
  const s = setup(); s.run('gmail-tabs-model.js'); const model = s.ctx.KNGmailTabs;
  assert.equal(model.current('#search/from%3Aa%40b.com%20has%3Aattachment/p2').query, 'from:a@b.com has:attachment');
  assert.equal(model.current('#label/Work%2FProject%20One').query, 'label:"Work/Project One"');
  assert.equal(model.current('#inbox').query, 'label:inbox');
  assert.equal(model.current('#search/%invalid'), null);
  assert.equal(model.current('#settings/general'), null);
  assert.equal(model.defaults()[0].query, 'label:unread label:inbox');
});
test('Gmail tabs migrate safely and preserve synchronized order', async () => {
  const legacy = [{ id: 'a', name: 'A', query: 'from:a' }];
  const newer = [{ id: 'b', name: 'B', query: 'from:b' }, ...legacy];
  const s = setup({ gmailFilterTabs: legacy }, { gmailFilterTabs: newer }); s.run('gmail-tabs-model.js');
  assert.deepEqual(await s.ctx.KNGmailTabs.read(), newer);
  const m = setup({ gmailFilterTabs: legacy }); m.run('gmail-tabs-model.js');
  assert.deepEqual(await m.ctx.KNGmailTabs.read(), legacy); assert.equal(m.local.gmailFilterTabs, undefined);
  const f = setup({ gmailFilterTabs: legacy }); f.run('gmail-tabs-model.js');
  f.ctx.chrome.storage.sync.set = async () => { throw Error('quota'); };
  await assert.rejects(f.ctx.KNGmailTabs.read(), /quota/); assert.deepEqual(f.local.gmailFilterTabs, legacy);
});
test('Gmail content assets are local and scoped to Gmail', () => {
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://mail.google.com/*']);
  for (const file of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) assert.ok(fs.existsSync(path.join(root, file)), file);
});
test('label color candidates exclude system labels, negations, and quoted search text', () => {
  const s = setup(); s.run('gmail-tabs-model.js');
  const labels = query => Array.from(s.ctx.KNGmailTabs.labelNames(query));
  assert.deepEqual(labels('label:unread label:inbox'), []);
  assert.deepEqual(labels('label:"Work/Project One" is:unread'), ['Work/Project One']);
  assert.deepEqual(labels('subject:"label:Personal" -label:Hidden label:Work'), ['Work']);
  assert.deepEqual(labels('{label:Work label:Personal}'), ['Work', 'Personal']);
  assert.deepEqual(labels('l:Work label:Work'), ['Work']);
});

function gmailFixture(s) {
  let document;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.handlers = {}; this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } }; }
    append(...children) { for (const c of children) { c.parentElement = this; this.children.push(c); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(k, fn) { (this.handlers[k] ||= []).push(fn); }
    async fire(k, extra = {}) { for (const fn of this.handlers[k] || []) await fn({ preventDefault() {}, stopPropagation() {}, ...extra }); }
    matches(selector) { return selector.startsWith('.') ? (this.className || '').split(' ').includes(selector.slice(1)) : selector === '[data-query]' ? this.dataset.query !== undefined : this.tag === selector; }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    showModal() { this.open = true; }
    close() { this.open = false; void this.fire('close'); }
    setCustomValidity(value) { this.validation = value; }
    reportValidity() {}
  }
  const body = new Element('body');
  document = { body, createElement: tag => new Element(tag), querySelectorAll: () => [], getElementById: id => {
    const walk = el => el.id === id ? el : el.children.map(walk).find(Boolean);
    return walk(body);
  } };
  const created = [];
  document.createElement = tag => { const el = new Element(tag); created.push(el); return el; };
  Object.assign(s.ctx, { document, location: { hash: '#inbox', href: 'https://mail.google.com/mail/u/0/#inbox' }, URL, CSS: { supports: () => true }, crypto: { randomUUID: () => 'new-tab' }, window: { addEventListener() {} }, MutationObserver: class { observe() {} }, setInterval() {}, setTimeout() {} });
  s.ctx.chrome.storage.onChanged = { addListener() {} };
  s.run('gmail-tabs-model.js'); s.run('gmail-tabs.js');
  return { document, bar: created.find(el => el.id === 'kn-gmail-tabs') };
}

test('Gmail edit, close, drag, and creation preserve filters and saved order', async () => {
  const s = setup({}, { gmailFilterTabs: [{ id: 'a', name: 'Work', query: 'label:Work' }, { id: 'b', name: 'Unread', query: 'is:unread' }] });
  const { document, bar } = gmailFixture(s);
  await new Promise(resolve => setImmediate(resolve));
  const items = () => bar.querySelectorAll('.kn-gct-item');
  const queryBefore = s.ctx.location.hash;
  await items()[0].querySelectorAll('button')[1].fire('click');
  const dialog = document.getElementById('kn-gct-dialog');
  const input = dialog.querySelector('input');
  assert.equal(input.value, 'Work'); assert.equal(input.selected, true);
  assert.equal(dialog.querySelector('textarea').disabled, true);
  assert.equal(dialog.querySelector('textarea').value, 'label:Work');
  input.value = 'Projects'; await dialog.querySelector('form').fire('submit');
  assert.equal(s.sync.gmailFilterTabs[0].name, 'Projects');
  assert.equal(s.sync.gmailFilterTabs[0].query, 'label:Work');
  assert.equal(s.ctx.location.hash, queryBefore);
  await items()[0].querySelector('.kn-gct-drag').fire('dragstart', { dataTransfer: { setData() {} } });
  await items()[1].fire('drop'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(s.sync.gmailFilterTabs, t => t.id), ['b', 'a']);
  await items()[0].querySelectorAll('button')[2].fire('click');
  assert.deepEqual(Array.from(s.sync.gmailFilterTabs, t => t.id), ['a']);
  await items()[0].querySelectorAll('button')[2].fire('click');
  assert.equal(s.sync.gmailFilterTabs.length, 0); assert.ok(bar.querySelector('.kn-gct-add'));
  await bar.querySelector('.kn-gct-add').fire('click');
  await document.getElementById('kn-gct-dialog').querySelector('form').fire('submit');
  assert.equal(s.sync.gmailFilterTabs[0].query, 'label:inbox');
});

test('standalone extension requests only storage and contains no note integrations', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.manifest_version, 3);
});
