// Version source: manifest.json (shared by extension pages and worker).
(() => {
  const { name: NAME, version: VERSION } = chrome.runtime.getManifest();
  const TAG = `[${NAME} v${VERSION}]`;
  globalThis.KN = Object.freeze({ NAME, VERSION, TAG,
    log: (scope, event) => console.info(`${TAG} [${scope}] ${event}`),
    error: (scope, event) => console.error(`${TAG} [${scope}] ${event}`)
  });
  KN.log('version', 'loaded');
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-version]').forEach(el => { el.textContent = `${NAME} v${VERSION}`; });
    });
  }
})();
// End version.js — version from manifest.json.
