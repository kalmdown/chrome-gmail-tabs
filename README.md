# Gmail Filter Tabs

A standalone Chrome Manifest V3 extension that adds saved filter tabs above Gmail’s message toolbar.

## Install

1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the `chrome-gmail-tabs` folder, then reload Gmail.

Requires Chrome 116 or newer. When switching from the combined kalmNotes development extension, disable that extension to avoid two tab bars being injected.

## Use

- **Unread Inbox** starts with `label:unread label:inbox`.
- Click a tab to open its filter in the current Gmail account.
- Open a search or label and click the circled **+**. The dialog selects the proposed name for replacement and displays the captured filter in a disabled multiline field.
- Drag the left grip onto another tab to reorder. Keyboard users can focus a tab and press Alt + Left/Right Arrow.
- Hover or focus a tab to reveal the pencil (rename) and X (remove). Removing a tab does not affect Gmail messages or labels.
- Tabs have light gray top/side borders and a 3px bottom border. A filter referencing one custom label uses the visible sidebar label icon’s explicit color when available; other filters use light gray.

Names, queries, and order sync through Chrome storage and are shared across Gmail accounts. Up to 40 tabs are supported, subject to Chrome sync storage limits. A legacy local `gmailFilterTabs` key within this extension’s storage migrates after a successful sync write. A separate extension ID has separate storage, so saved tabs from the combined extension do not transfer automatically.

## Development

`manifest.json` is the only numeric version source. `version.js` derives the shared log identity from it. Scripts and CSS are local. No build step or npm dependencies are required.

Run `node --test tests/extension.test.cjs` or `npm test` with Node 18+.

Gmail uses an undocumented DOM. Automated tests use local fixtures; live toolbar placement, label colors, drag behavior, and navigation still require manual verification. Check Inbox, a custom colored label, an empty search, opening/returning from a message, multiple accounts, rename/remove, and persistence after reload.

## Privacy

The extension runs only on `https://mail.google.com/*` and requests the storage permission. It reads the current Gmail route and sidebar label metadata, and stores saved filter queries and tab names in Chrome sync. It does not send messages, read message bodies, use a Gmail API token, or include the original note-capture integrations.

## Origin

Extracted from the Gmail tab feature developed in `kalmdown-gmail-tabs`. The original kalmNotes project remains separate.
