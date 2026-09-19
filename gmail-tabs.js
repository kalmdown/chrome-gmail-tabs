// Version source: manifest.json via version.js.
(() => {
  const model = KNGmailTabs;
  let tabs = [], dragged = null, busy = false;
  const bar = document.createElement('div');
  bar.id = 'kn-gmail-tabs';
  bar.setAttribute('aria-label', 'Saved Gmail filters');
  const status = document.createElement('span');
  status.className = 'kn-gct-status';
  status.setAttribute('role', 'status');
  function isolate(event) { event.stopPropagation(); }
  ['click', 'dblclick', 'keydown', 'keyup', 'keypress', 'pointerdown'].forEach(type => bar.addEventListener(type, isolate));
  async function save(next) {
    if (busy) return false;
    busy = true;
    try {
      await chrome.storage.sync.set({ [model.KEY]: next });
      tabs = next; render(); return true;
    } catch { status.textContent = 'Could not save tabs. Chrome sync may be unavailable or full.'; return false; }
    finally { busy = false; }
  }
  function active() {
    const query = model.current(location.hash)?.query;
    bar.querySelectorAll('[data-query]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.query === query)));
  }
  async function move(source, target) {
    const next = [...tabs];
    const from = next.findIndex(t => t.id === source), to = next.findIndex(t => t.id === target);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    await save(next);
  }
  function labelColor(query) {
    const labels = model.labelNames(query);
    if (labels.length !== 1) return '';
    const label = labels[0];
    for (const entry of document.querySelectorAll('[role="navigation"] [data-label-name], [role="navigation"] a[href*="#label/"], [role="navigation"] .TO [title]')) {
      let route;
      try { route = model.current(new URL(entry.getAttribute('href') || '', location.href).hash); } catch { /* Not a link. */ }
      if (entry.getAttribute('data-label-name') !== label && entry.getAttribute('title') !== label && route?.name !== label) continue;
      const row = entry.closest('.TO') || entry.closest('[data-label-name]') || entry.parentElement;
      // Gmail's colored label icon carries an explicit color. Do not use text/row
      // colors, which may just be theme colors or selection highlights.
      const icon = row?.querySelector('.qj, [data-label-color]');
      if (!icon) continue;
      for (const source of [icon, ...icon.querySelectorAll('[style]')]) {
        const color = source.getAttribute('data-label-color') || source.style.color || source.style.backgroundColor;
        if (color && color !== 'transparent' && color !== 'inherit' && CSS.supports('color', color)) return color;
      }
    }
    return '';
  }
  function refreshColors() {
    for (const item of bar.querySelectorAll('.kn-gct-item')) {
      const color = labelColor(item.querySelector('[data-query]').dataset.query);
      // Only the dynamic Gmail color is passed to CSS; all styling lives in CSS.
      if (color) item.style.setProperty('--kn-label-color', color);
      else item.style.removeProperty('--kn-label-color');
    }
  }
  function render() {
    bar.replaceChildren();
    for (const tab of tabs) {
      const item = document.createElement('div'); item.className = 'kn-gct-item';
      const handle = document.createElement('span'); handle.className = 'kn-gct-drag';
      handle.textContent = '⠿'; handle.draggable = true;
      handle.title = 'Drag to reorder'; handle.setAttribute('aria-hidden', 'true');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'kn-gct-tab';
      button.textContent = tab.name; button.dataset.query = tab.query;
      button.title = `${tab.query}\nAlt + Left/Right Arrow to reorder.`;
      button.addEventListener('click', () => { location.hash = `search/${encodeURIComponent(tab.query)}`; });
      handle.addEventListener('dragstart', event => { dragged = tab.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tab.id); });
      handle.addEventListener('dragend', () => { dragged = null; });
      item.addEventListener('dragover', event => { if (dragged) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
      item.addEventListener('drop', event => { event.preventDefault(); event.stopPropagation(); if (dragged) void move(dragged, tab.id); dragged = null; });
      button.addEventListener('keydown', async event => {
        if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.findIndex(t => t.id === tab.id), target = tabs[index + (event.key === 'ArrowLeft' ? -1 : 1)];
        if (target) { await move(tab.id, target.id); [...bar.querySelectorAll('[data-query]')][tabs.findIndex(t => t.id === tab.id)]?.focus(); }
      });
      const controls = document.createElement('span'); controls.className = 'kn-gct-controls';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'kn-gct-icon'; edit.textContent = '✎';
      edit.title = `Edit ${tab.name}`; edit.setAttribute('aria-label', edit.title);
      edit.addEventListener('click', () => openDialog(tab));
      const close = document.createElement('button'); close.type = 'button'; close.className = 'kn-gct-icon'; close.textContent = '×';
      close.title = `Close ${tab.name}`; close.setAttribute('aria-label', close.title);
      close.addEventListener('click', async () => {
        const index = tabs.findIndex(t => t.id === tab.id);
        if (await save(tabs.filter(t => t.id !== tab.id))) {
          const remaining = bar.querySelectorAll('[data-query]');
          (remaining[Math.min(index, remaining.length - 1)] || bar.querySelector('.kn-gct-add')).focus();
        }
      });
      controls.append(edit, close); item.append(handle, button, controls); bar.append(item);
    }
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'kn-gct-add'; add.textContent = '+';
    add.setAttribute('aria-label', 'Create tab from current filter');
    add.addEventListener('click', () => openDialog());
    bar.append(add, status); active(); refreshColors();
  }
  function openDialog(editing = null) {
    if (document.getElementById('kn-gct-dialog')) return;
    const filter = editing || model.current(location.hash);
    if (!filter) { status.textContent = 'Open a Gmail search or label first.'; return; }
    if (!editing && tabs.length >= 40) { status.textContent = 'The maximum is 40 saved tabs.'; return; }
    status.textContent = '';
    const dialog = document.createElement('dialog'); dialog.id = 'kn-gct-dialog';
    dialog.setAttribute('aria-labelledby', 'kn-gct-heading');
    const form = document.createElement('form');
    const heading = document.createElement('h2'); heading.id = 'kn-gct-heading'; heading.textContent = editing ? 'Edit filter tab' : 'Create filter tab';
    const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name';
    const name = document.createElement('input'); name.value = filter.name; name.required = true; name.maxLength = 100;
    nameLabel.append(name);
    const queryLabel = document.createElement('label'); queryLabel.textContent = 'Filter';
    const query = document.createElement('textarea'); query.value = filter.query; query.disabled = true; query.rows = 4; queryLabel.append(query);
    const error = document.createElement('p'); error.setAttribute('role', 'alert');
    const actions = document.createElement('div'); actions.className = 'kn-gct-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dialog.close());
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = editing ? 'Save changes' : 'Create tab';
    actions.append(cancel, submit); form.append(heading, nameLabel, queryLabel, error, actions); dialog.append(form);
    ['click', 'keydown', 'keyup', 'keypress', 'pointerdown'].forEach(type => dialog.addEventListener(type, isolate));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!name.value.trim()) { name.setCustomValidity('Enter a name.'); name.reportValidity(); return; }
      submit.disabled = true;
      if (editing && !tabs.some(t => t.id === editing.id)) {
        error.textContent = 'This tab was removed in another window.'; submit.disabled = false; return;
      }
      const next = editing
        ? tabs.map(t => t.id === editing.id ? { ...t, name: name.value.trim() } : t)
        : [...tabs, { id: crypto.randomUUID(), name: name.value.trim(), query: filter.query }];
      if (await save(next)) dialog.close();
      else { error.textContent = 'Could not save. Please try again.'; submit.disabled = false; }
    });
    name.addEventListener('input', () => name.setCustomValidity(''));
    dialog.addEventListener('close', () => { dialog.remove(); const index = editing ? tabs.findIndex(t => t.id === editing.id) : -1; (bar.querySelectorAll('[data-query]')[index] || bar.querySelector('.kn-gct-add'))?.focus(); });
    document.body.append(dialog); dialog.showModal(); name.focus(); name.select();
  }
  function mount() {
    // Prefer the actual message toolbar; never mount in the navigation sidebar.
    const mains = [...document.querySelectorAll('[role="main"]')].filter(el => el.getClientRects().length);
    let toolbar;
    for (const main of mains) {
      toolbar = [...main.querySelectorAll('[role="toolbar"], .G-atb')].find(el => el.getClientRects().length && !el.closest('#kn-gmail-tabs'));
      if (toolbar) break;
    }
    if (!toolbar) { bar.remove(); return; }
    if (bar.parentElement !== toolbar.parentElement || bar.nextElementSibling !== toolbar) toolbar.before(bar);
    refreshColors();
  }
  let timer;
  const observer = new MutationObserver(records => {
    if (records.every(record => bar.contains(record.target))) return;
    clearTimeout(timer); timer = setTimeout(mount, 200);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && model.valid(changes[model.KEY]?.newValue)) { tabs = changes[model.KEY].newValue; render(); }
  });
  window.addEventListener('hashchange', active);
  async function start() {
    try { tabs = await model.read(); render(); mount(); observer.observe(document.body, { childList: true, subtree: true }); setInterval(mount, 3000); KN.log('gmail-tabs', 'loaded'); }
    catch { KN.error('gmail-tabs', 'Could not load saved tabs'); setTimeout(start, 5000); }
  }
  void start();
})();
// End gmail-tabs.js — version from manifest.json.
