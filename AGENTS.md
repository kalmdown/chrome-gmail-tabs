# chrome-gmail-tabs

This is the standalone Gmail filter-tab extension. Read README.md before changes.

- Keep manifest.json as the sole numeric version source; version.js derives log identity.
- Keep scripts local and styling in external CSS. Dynamic Gmail label colors may be passed as CSS custom properties.
- Limit content scripts to Gmail and preserve the storage-only permission scope unless a feature requires otherwise.
- Preserve synchronized tabs, safe local preference migration, and Gmail SPA mounting recovery.
- Never log filter queries, message contents, or credentials.
- Run `node --test tests/extension.test.cjs` after behavior changes.
- Automated fixtures do not prove compatibility with live Gmail; report manual verification separately.
