# Home URL routing — 2026-11-04

## Report and investigation

- Report: on a smartphone, opening `https://alicelidde1e.github.io/atlantis/#home` changes the screen and URL to `#decks`.
- Investigated baseline: `a508a8b` (rev.44). The public `app.mjs?v=20261101b` matched the repository byte for byte.
- The reported full redirect was not reproduced in the available desktop cloud browser. No mobile-only redirect exists in the current source. Android Chrome device reproduction remains unverified; do not treat these changes as proof that the reported device symptom is resolved.
- A related state inconsistency was reproduced: after navigating to `#home`, `restoreSearch()` reads a legacy session with `currentView: "decks"` and overwrites the internal view with `decks`, while the URL and visible section still indicate Home. The existing final `navigate()` normally reconciles this after loading. This finding alone does not establish the cause of the reported URL change.

## Changes

- Search persistence now contains filters, selected cards, display mode and pagination only. Legacy `currentView` is ignored.
- Screen selection follows the current URL at startup, after loading, on hash/history navigation and on `pageshow` (including restored tabs).
- Internal route links apply immediately. Clicking Home works even if the current hash is already `#home`, and closes the mobile menu. New routes still create history entries.
- Native skip anchors, modified clicks, new-tab targets and download links retain their normal behavior.
- `app.mjs` is loaded with `v=20261104a` so the updated HTML requests a fresh script.

## Validation

- `node routing.test.mjs`: production search/routing functions tested with legacy session data, Home and other routes, same-hash Home links, menu closing, history/hash/page restoration, search preservation and native-anchor handling.
- Running the regression against the published baseline fails on internal view `decks` versus expected `home`; the revised source passes. This reproduces the internal state mismatch, not the full Android redirect.
- All commands in `.github/workflows/check.yml` passed locally, including publishing data, search, saved-deck workbench, exports, printing selection and public package validation. The routing regression is included in both CI and the deployment workflow.
- Remaining device check: open `#home` directly in Android Chrome; visit Decks and return through the logo/Menu → Home; reload Home; return to Home through browser Back; verify both visible screen and hash stay consistent after data loading completes.
