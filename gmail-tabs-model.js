// Version source: manifest.json via version.js.
(() => {
  const KEY = 'gmailFilterTabs';
  const defaults = () => [{ id: 'unread-inbox', name: 'Unread Inbox', query: 'label:unread label:inbox' }];
  function current(hash) {
    const parts = hash.replace(/^#/, '').split('/');
    let value;
    try { value = decodeURIComponent(parts[1] || ''); } catch { return null; }
    if (parts[0] === 'search' && value) return { name: value, query: value };
    if (parts[0] === 'label' && value) return { name: value, query: `label:"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` };
    const views = { inbox: ['Inbox', 'label:inbox'], starred: ['Starred', 'is:starred'], snoozed: ['Snoozed', 'in:snoozed'], sent: ['Sent', 'in:sent'], drafts: ['Drafts', 'in:drafts'], all: ['All Mail', '-in:spam -in:trash'], spam: ['Spam', 'in:spam'], trash: ['Trash', 'in:trash'], important: ['Important', 'is:important'] };
    const view = views[parts[0] || 'inbox'];
    return view ? { name: view[0], query: view[1] } : null;
  }
  function labelNames(query) {
    // Tokenize quoted phrases too, so text like subject:"label:Work" is not a label.
    const tokens = query.match(/(?:[^\s"{}()]+|"(?:\\.|[^"\\])*")+/g) || [];
    const system = new Set(['inbox', 'unread', 'read', 'starred', 'important', 'sent', 'draft', 'drafts', 'spam', 'trash', 'all', 'snoozed']);
    return [...new Set(tokens.flatMap(token => {
      const match = /^(?:label|l):("(?:\\.|[^"\\])*"|[^"\s]+)$/i.exec(token);
      if (!match) return [];
      const value = match[1].startsWith('"') ? match[1].slice(1, -1).replace(/\\(.)/g, '$1') : match[1];
      return system.has(value.toLowerCase()) ? [] : [value];
    }))];
  }
  function valid(value) {
    return Array.isArray(value) && value.length <= 40 && value.every(t => t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim() && typeof t.query === 'string' && t.query.trim()) && new Set(value.map(t => t.id)).size === value.length;
  }
  async function read() {
    const synced = await chrome.storage.sync.get(KEY);
    if (valid(synced[KEY])) return synced[KEY];
    const local = await chrome.storage.local.get(KEY);
    const tabs = valid(local[KEY]) ? local[KEY] : defaults();
    await chrome.storage.sync.set({ [KEY]: tabs });
    if (valid(local[KEY])) await chrome.storage.local.remove(KEY);
    return tabs;
  }
  globalThis.KNGmailTabs = { KEY, current, labelNames, valid, read, defaults };
})();
// End gmail-tabs-model.js — version from manifest.json.
