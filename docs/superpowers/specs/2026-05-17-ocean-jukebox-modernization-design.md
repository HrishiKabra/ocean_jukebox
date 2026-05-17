# Ocean Jukebox Modernization Design

## Goal

Modernize Ocean Jukebox as one coordinated implementation organized into three phases: foundation, confidence, and product polish. The work should preserve the current product behavior while making the codebase easier to maintain, safer to change, and better aligned with GitHub Pages hosting.

The app will optimize for HTTP-served environments such as GitHub Pages and local static servers. Double-click `file://` support is no longer a design constraint.

## Current State

Ocean Jukebox is a no-build static app. `index.html` defines the UI and styles, `app.js` owns most browser behavior, and generated browser-global data files provide catalog, sanctuary, live-source, and audio artifact data.

`app-core.mjs` already contains tested pure logic for routing, filtering, track IDs, waveform artifacts, live-source normalization, and map pin generation. `app.js` duplicates much of that logic, which creates drift risk. The existing Node test suite covers pure behavior well, but there is no browser smoke test for the real UI.

## Target Architecture

`index.html` will load a single ES module entry point:

```html
<script type="module" src="./js/main.js"></script>
```

Generated data files can remain browser globals for now, because they are simple and GitHub Pages friendly. The app runtime will be split into focused browser modules:

- `js/main.js`: boot sequence, module wiring, initial render, event binding.
- `js/app-state.js`: shared mutable state, state initialization, derived selectors.
- `js/dom.js`: element lookup and DOM cache helpers.
- `js/routes.js`: route parsing, route application, URL syncing, `popstate` handling.
- `js/player.js`: audio element control, transport actions, progress, playback status.
- `js/archive-view.js`: archive filters, category bar, track list, detail panel, variants.
- `js/map-view.js`: Leaflet setup, marker rendering, map filters, map summary.
- `js/live-view.js`: live-source cards and clearer separation from historical archive clips.
- `js/spectrogram-view.js`: spectrogram image display and empty-state handling.
- `js/service-worker.js`: service worker registration.

Pure helpers must be imported from `app-core.mjs` rather than copied into browser modules. This makes `app-core.mjs` the single source of truth for shared behavior.

## Phase 1: Foundation

Split `app.js` into ES modules without changing the visible product. Replace duplicated browser helper implementations with imports from `app-core.mjs`.

Add a minimal `package.json` with discoverable scripts:

- `test`: run Node tests.
- `validate:catalog`: validate checked-in catalog data.
- `catalog:refresh`: refresh the generated catalog from NOAA.
- `analyze:audio`: regenerate preview audio artifacts.
- `check:catalog-sources`: check archive audio URL health.
- `test:browser`: run the browser smoke test.

The old `app.js` can be removed or replaced by a tiny compatibility note only if no script tag references it.

## Phase 2: Confidence

Add browser smoke coverage with Playwright. The test should serve the repo as a static site, open the app over HTTP, and verify:

- The page loads and renders a real first track.
- Category filtering changes the result set.
- The play button updates UI state without requiring successful remote audio playback.
- The map tab opens without crashing.
- The spectrogram tab shows either an existing image or the empty state.

Add catalog JSON Schema validation alongside the current custom validator. The schema should document the catalog contract for fields including `filename`, `url`, `sanctuary`, `category`, `recordedAt`, `site`, `deployment`, `variant`, and `groupKey`. The existing custom validator should stay because it checks domain-specific constraints that JSON Schema does not express cleanly.

Add `scripts/check-catalog-sources.mjs` to check the health of archive audio URLs. It should use `HEAD` first and fall back to a ranged `GET` when needed, then write a concise report without modifying the catalog by default.

## Phase 3: Product Polish

Clarify offline behavior. The service worker should cache the app shell and generated local metadata, but the app should not imply that external NOAA audio, Leaflet tiles, or CDN assets are available offline. The README and UI copy should call this "offline shell" behavior.

Make the generated asset story explicit. Because full spectrogram and waveform image assets are not checked in for every track, the UI should treat generated images as optional enhancements. Waveform bars should continue to use artifact peak data or deterministic previews. The spectrogram tab should avoid broken images and clearly show when no image is available.

Tighten accessibility around dynamic state:

- Return focus to the details button when the detail panel closes.
- Keep tab keyboard behavior predictable.
- Avoid excessive `aria-live` updates during normal playback progress.
- Confirm icon-only buttons have stable accessible labels.

Make the Live tab visually and textually distinct from the historical NOAA archive. Live cards should state that sources are separate, may be delayed or offline, and are not part of the SanctSound catalog.

## Data Flow

At startup, `main.js` reads browser-global generated data from `sounds.js`, `sanctuaries.js`, `live-sources.js`, and `audio-artifacts.js`, then initializes shared state. Route state is parsed from `window.location.search` using `app-core.mjs`, normalized against available categories, sanctuaries, tabs, and years, then applied to state.

Views render from state and call explicit state/action functions rather than mutating unrelated modules directly. User events update state, trigger the relevant view renders, and synchronize the URL when needed. Audio element events update playback state and progress only through the player module.

## Error Handling

The app should continue to render useful static content if optional integrations are unavailable:

- If Leaflet is unavailable, the map tab shows a non-crashing fallback message.
- If a spectrogram image is missing, the spectrogram tab shows the existing empty state.
- If audio playback fails, the player status reports the error without breaking navigation.
- If live sources have no direct stream, the card links to the source page and labels the source as page-only.

Scripts should exit non-zero for validation failures and severe test failures. Network source checks should distinguish unavailable sources from script errors.

## Testing

Keep the existing `node --test` suite for pure logic and catalog parsing. Expand or adjust those tests when module extraction changes public helper boundaries.

Add Playwright smoke tests for the real browser surface. The browser smoke suite is not a replacement for unit tests; it catches broken DOM wiring, script loading, route integration, and tab rendering.

Run these checks before considering the work complete:

```bash
npm test
npm run validate:catalog
npm run test:browser
```

The archive source-health check may depend on network availability and should be runnable separately:

```bash
npm run check:catalog-sources
```

## Out Of Scope

This modernization will not introduce a frontend framework, bundler, backend service, database, or hosted proxy for NOAA audio. It will not require all spectrogram and waveform image assets to be generated in this pass. It will not redesign the whole visual identity beyond targeted Live tab, offline, generated-asset, and accessibility improvements.
