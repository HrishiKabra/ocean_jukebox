# Ocean Jukebox Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize Ocean Jukebox into a maintainable ES-module static app with browser smoke coverage, catalog schema validation, archive source checks, and targeted product polish.

**Architecture:** Keep the app static and GitHub Pages friendly. `index.html` loads generated data globals, then loads `js/main.js` as the single ES-module entry point. Pure behavior lives in `app-core.mjs`; browser modules import from it instead of duplicating routing, filtering, map, waveform, and live-source helpers.

**Tech Stack:** Vanilla HTML/CSS/JS, ES modules, Node.js built-in test runner, Playwright for browser smoke tests, JSON Schema expressed as repo-local JSON and validated by a small local script, GitHub Pages compatible static assets.

---

## File Structure

Create:

- `package.json`: command discovery for tests, validation, catalog refresh, audio analysis, source checks, and browser smoke tests.
- `js/main.js`: boot entry point, module wiring, initial render, event binding.
- `js/app-state.js`: state initialization, catalog selectors, filter setters, current-track helpers.
- `js/dom.js`: DOM lookup/cache helper.
- `js/routes.js`: route apply/sync/popstate integration using `app-core.mjs`.
- `js/player.js`: audio element control, transport controls, progress, playback status.
- `js/archive-view.js`: archive filters, category buttons, track list, detail panel, variant controls.
- `js/map-view.js`: Leaflet setup, map filters, marker rendering, fallback rendering.
- `js/live-view.js`: live-source cards and separate-live-source warning copy.
- `js/spectrogram-view.js`: optional spectrogram image rendering and empty state.
- `js/service-worker.js`: service worker registration.
- `catalog.schema.json`: JSON Schema for checked-in catalog records.
- `scripts/validate-catalog-schema.mjs`: schema validator with no third-party dependency.
- `scripts/check-catalog-sources.mjs`: remote archive URL health checker.
- `tests/browser-smoke.test.mjs`: Playwright smoke tests for the real static app.
- `playwright.config.mjs`: Playwright configuration.
- `.github/workflows/test.yml`: CI for Node tests and catalog validation.

Modify:

- `index.html`: replace `app.js` script with `type="module" src="./js/main.js"`, add small copy/style changes for offline shell, live-source distinction, and accessible dynamic status.
- `app-core.mjs`: add any missing pure helper exports needed by modules, especially `getVisibleIndexes`, `buildLiveSourceCards`, `buildFilteredMapPins`, `buildVariantGroups`, `buildTrackDetail`, `formatCount`, and cache manifest helpers.
- `sw.js`: keep app shell caching aligned with `buildStaticCacheManifest()` and add `./js/...` module files.
- `README.md`: document HTTP serving, package scripts, offline shell limits, schema validation, source checks, and generated-asset policy.
- `tests/app-core.test.mjs`: add helper coverage listed in Task 2 and adjust the cache manifest assertion listed in Task 8.

Remove:

- `app.js` only after `index.html` no longer references it and the browser smoke test passes. If keeping it briefly, leave it unreferenced and delete it in the final cleanup task.

---

## Task 1: Add Command Surface And CI Skeleton

**Files:**

- Create: `package.json`
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create `package.json` with scripts**

```json
{
  "name": "ocean-jukebox",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate:catalog": "node scripts/validate-catalog.mjs",
    "catalog:refresh": "node scripts/catalog.mjs",
    "analyze:audio": "node scripts/analyze-audio.mjs",
    "check:catalog-sources": "node scripts/check-catalog-sources.mjs",
    "test:browser": "playwright test"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create CI workflow**

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm test
      - run: npm run validate:catalog
```

- [ ] **Step 3: Verify current unit tests still pass**

Run:

```bash
npm test
```

Expected:

```text
# tests 43
# pass 43
# fail 0
```

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/test.yml
git commit -m "chore: add project scripts and test workflow"
```

---

## Task 2: Prepare Shared Core For Browser Modules

**Files:**

- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`

- [ ] **Step 1: Add focused tests for shared browser helpers**

Append tests that prove app-core can replace duplicated browser logic:

```js
test('getVisibleIndexes filters by category sanctuary query and explicit order', () => {
  assert.deepEqual(
    getVisibleIndexes(tracks, {
      category: 'whale',
      sanctuary: 'Hawaiian Islands',
      query: 'hump',
      sort: 'curated',
      order: [2, 1, 0],
    }),
    [0],
  );
});

test('buildVariantGroups treats duplicate originals as enhanced alternatives', () => {
  const groups = buildVariantGroups([
    { filename: 'a.mp4', groupKey: 'g', variant: 'original' },
    { filename: 'b.mp4', groupKey: 'g', variant: 'original' },
  ]);

  assert.equal(groups.get('g').original.filename, 'a.mp4');
  assert.deepEqual(groups.get('g').enhanced.map(track => track.filename), ['b.mp4']);
});
```

If `getVisibleIndexes` and `buildVariantGroups` are already imported in `tests/app-core.test.mjs`, do not add duplicate import names.

- [ ] **Step 2: Run the new tests**

Run:

```bash
npm test -- tests/app-core.test.mjs
```

Expected: PASS. If the command runs the full suite because of Node test argument behavior, the full suite must still pass.

- [ ] **Step 3: Export missing pure helpers only if tests reveal a gap**

Keep helper exports minimal. Do not move DOM, `window`, `document`, `Audio`, or Leaflet behavior into `app-core.mjs`.

Required pure exports after this task:

```js
export {
  CATEGORY_LABELS,
  SORT_LABELS,
  DEFAULT_ROUTE,
  trackId,
  buildSpectrogramPath,
  buildWaveformPath,
  parseRoute,
  normalizeRoute,
  serializeRoute,
  buildRouteState,
  getVisibleIndexes,
  createCatalogState,
  formatDate,
  buildTrackDetail,
  normalizeWaveformPeaks,
  buildPreviewWaveform,
  buildAcousticProfile,
  buildAudioArtifact,
  buildLiveSourceCards,
  normalizeLiveSourceStatus,
  buildStaticCacheManifest,
  buildVariantGroups,
  projectMapPosition,
  buildMapPins,
  recordingYear,
  buildYearOptions,
  buildFilteredMapPins,
  formatCount,
  buildMapPinSummary,
};
```

The existing file already uses named `export` declarations. Keep that style; do not add an aggregate export block if it would duplicate names.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app-core.mjs tests/app-core.test.mjs
git commit -m "test: cover shared app core browser helpers"
```

---

## Task 3: Create ES Module App Shell

**Files:**

- Create: `js/dom.js`
- Create: `js/app-state.js`
- Create: `js/service-worker.js`
- Create: `js/main.js`
- Modify: `index.html`

- [ ] **Step 1: Create `js/dom.js`**

```js
export function byId(id, root = document) {
  return root.getElementById(id);
}

export function cacheElements(root = document) {
  return {
    catalogMeta: byId('catalog-meta', root),
    archiveNote: byId('archive-note', root),
    tabs: [...root.querySelectorAll('.tab')],
    archivePanel: byId('archive-panel', root),
    mapPanel: byId('map-panel', root),
    livePanel: byId('live-panel', root),
    spectrogramPanel: byId('spectrogram-panel', root),
    sanctuary: byId('s-sanctuary', root),
    category: byId('s-cat', root),
    label: byId('s-label', root),
    description: byId('s-desc', root),
    date: byId('s-date', root),
    site: byId('s-site', root),
    file: byId('s-file', root),
    waveform: byId('waveform', root),
    prevButton: byId('btn-prev', root),
    playButton: byId('btn-play', root),
    playIcon: byId('play-icon', root),
    nextButton: byId('btn-next', root),
    shuffleButton: byId('btn-shuffle', root),
    detailsButton: byId('btn-details', root),
    progress: byId('progress', root),
    status: byId('status', root),
    time: byId('time', root),
    detailPanel: byId('track-detail', root),
    detailTitle: byId('detail-title', root),
    detailCloseButton: byId('btn-detail-close', root),
    detailSanctuary: byId('detail-sanctuary', root),
    detailCategory: byId('detail-category', root),
    detailRecorded: byId('detail-recorded', root),
    detailSite: byId('detail-site', root),
    detailDeployment: byId('detail-deployment', root),
    detailDuration: byId('detail-duration', root),
    detailProfile: byId('detail-profile', root),
    detailFilename: byId('detail-filename', root),
    detailDescription: byId('detail-description', root),
    detailVariants: byId('detail-variants', root),
    detailSourceLink: byId('detail-source-link', root),
    copySourceButton: byId('btn-copy-source', root),
    query: byId('search-input', root),
    sanctuarySelect: byId('sanctuary-filter', root),
    sortSelect: byId('sort-select', root),
    categoryBar: byId('cat-bar', root),
    resultCount: byId('result-count', root),
    trackList: byId('tlist', root),
    emptyState: byId('empty-state', root),
    mapCategoryFilter: byId('map-category-filter', root),
    mapYearFilter: byId('map-year-filter', root),
    leafletMap: byId('leaflet-map', root),
    mapSummary: byId('map-summary', root),
    liveGrid: byId('live-grid', root),
    spectrogramEmpty: byId('spectrogram-empty', root),
    spectrogramImg: byId('spectrogram-img', root),
    audio: byId('audio', root),
  };
}
```

- [ ] **Step 2: Create `js/app-state.js`**

```js
import {
  buildVariantGroups,
  buildYearOptions,
  getVisibleIndexes,
  trackId,
} from '../app-core.mjs';

export const FALLBACK_CATALOG = {
  source: 'https://sanctsound.ioos.us/sounds.html',
  baseUrl: 'https://sanctsound.ioos.us/files/',
  generatedAt: null,
  archiveNote: 'NOAA SanctSound is a historical passive acoustic archive. These clips are recordings from the 2018-2021/2022 project period, not realtime audio.',
  tracks: [],
};

export function createAppState(globals = window) {
  const catalog = globals.OCEAN_JUKEBOX_CATALOG || FALLBACK_CATALOG;
  const tracks = catalog.tracks || [];
  return {
    catalog,
    sanctuaries: globals.OCEAN_JUKEBOX_SANCTUARIES || [],
    liveSources: globals.OCEAN_JUKEBOX_LIVE_SOURCES || [],
    audioArtifacts: globals.OCEAN_JUKEBOX_AUDIO_ARTIFACTS || { artifacts: {} },
    tracks,
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    activeTab: 'archive',
    shuffled: false,
    order: tracks.map((_, index) => index),
    currentIndex: 0,
    visibleIndexes: tracks.map((_, index) => index),
    variantGroups: buildVariantGroups(tracks),
    playing: false,
    selectedYear: 'all',
    isApplyingRoute: false,
    leaflet: null,
    leafletLayer: null,
  };
}

export function currentTrack(state) {
  return state.tracks[state.currentIndex] || null;
}

export function currentAudioArtifact(state, track = currentTrack(state)) {
  if (!track) return null;
  return (state.audioArtifacts.artifacts || {})[trackId(track)] || null;
}

export function categoryList(state) {
  return ['all', ...new Set(state.tracks.map(track => track.category).filter(Boolean))];
}

export function sanctuaryList(state) {
  return ['all', ...new Set(state.tracks.map(track => track.sanctuary).filter(Boolean).sort())];
}

export function tabList() {
  return ['archive', 'map', 'live', 'spectrogram'];
}

export function yearList(state) {
  return buildYearOptions(state.tracks);
}

export function recomputeVisible(state) {
  state.visibleIndexes = getVisibleIndexes(state.tracks, state);
  if (state.visibleIndexes.length && !state.visibleIndexes.includes(state.currentIndex)) {
    state.currentIndex = state.visibleIndexes[0];
  }
}

export function setCurrentTrack(state, index) {
  if (Number.isInteger(index) && index >= 0 && index < state.tracks.length) {
    state.currentIndex = index;
  }
}
```

- [ ] **Step 3: Create `js/service-worker.js`**

```js
export function registerServiceWorker(win = window) {
  if (!('serviceWorker' in win.navigator)) return;
  win.addEventListener('load', () => {
    win.navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```

- [ ] **Step 4: Create temporary `js/main.js`**

This temporary entry point proves module loading before moving all behavior:

```js
import { cacheElements } from './dom.js';
import { createAppState } from './app-state.js';
import { registerServiceWorker } from './service-worker.js';

function init() {
  const els = cacheElements();
  const state = createAppState();
  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 5: Update `index.html` script loading**

Replace:

```html
<script src="./app.js"></script>
```

With:

```html
<script type="module" src="./js/main.js"></script>
```

- [ ] **Step 6: Verify module loading over HTTP**

Run:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` and verify the catalog meta line changes from loading text to the loaded recording count. Stop the server after checking.

- [ ] **Step 7: Run unit tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add index.html js/dom.js js/app-state.js js/service-worker.js js/main.js
git commit -m "feat: add modular browser app shell"
```

---

## Task 4: Extract Routing And Tab State

**Files:**

- Create: `js/routes.js`
- Modify: `js/main.js`
- Modify: `js/app-state.js`

- [ ] **Step 1: Create `js/routes.js`**

```js
import {
  buildRouteState,
  normalizeRoute,
  parseRoute,
  serializeRoute,
} from '../app-core.mjs';

import {
  categoryList,
  currentTrack,
  recomputeVisible,
  sanctuaryList,
  tabList,
  yearList,
} from './app-state.js';

export function trackMatchesMapFilters(state, track) {
  if (!track) return false;
  const matchesCategory = state.category === 'all' || track.category === state.category;
  const matchesYear = state.selectedYear === 'all' || new Date(track.recordedAt).getUTCFullYear() === Number(state.selectedYear);
  return matchesCategory && matchesYear;
}

export function applyRoute(state, route) {
  state.isApplyingRoute = true;
  const normalized = normalizeRoute(route, {
    categories: categoryList(state),
    sanctuaries: sanctuaryList(state),
    tabs: tabList(),
    years: yearList(state),
  });

  state.category = normalized.category;
  state.sanctuary = normalized.sanctuary;
  state.query = normalized.query;
  state.sort = normalized.sort;
  state.activeTab = normalized.tab;
  state.selectedYear = normalized.year;
  recomputeVisible(state);

  if (normalized.track) {
    const foundIndex = state.tracks.findIndex(track => track.filename.replace(/\.[^.]*$/, '') === normalized.track);
    if (foundIndex >= 0) state.currentIndex = foundIndex;
  }

  state.isApplyingRoute = false;
}

export function syncUrl(state, method = 'replaceState', win = window) {
  if (state.isApplyingRoute) return;
  if (!win.history || !win.history.replaceState) return;
  const selected = currentTrack(state);
  const routeTrack = state.activeTab === 'map' && !trackMatchesMapFilters(state, selected) ? null : selected;
  const query = serializeRoute(buildRouteState({
    activeTab: state.activeTab,
    category: state.category,
    sanctuary: state.sanctuary,
    query: state.query,
    sort: state.sort,
    selectedYear: state.selectedYear,
    currentTrack: routeTrack,
  }));
  const nextUrl = `${win.location.pathname}${query}${win.location.hash}`;
  const currentUrl = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  if (nextUrl === currentUrl) return;
  try {
    const historyMethod = method === 'pushState' && win.history.pushState ? 'pushState' : 'replaceState';
    win.history[historyMethod](null, '', nextUrl);
  } catch (_error) {
    // Some restricted contexts can reject history updates; playback should still work.
  }
}

export function applyCurrentLocationRoute(state, win = window) {
  applyRoute(state, parseRoute(win.location.search));
}

export function bindRouteEvents(state, renderAll, win = window) {
  win.addEventListener('popstate', () => {
    applyRoute(state, parseRoute(win.location.search));
    renderAll();
  });
}
```

- [ ] **Step 2: Wire route initialization in `js/main.js`**

Replace the temporary `init()` body with:

```js
function init() {
  const els = cacheElements();
  const state = createAppState();
  applyCurrentLocationRoute(state);
  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  bindRouteEvents(state, () => {
    if (els.catalogMeta) {
      els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
    }
  });
  registerServiceWorker();
}
```

And add imports:

```js
import {
  applyCurrentLocationRoute,
  bindRouteEvents,
} from './routes.js';
```

- [ ] **Step 3: Verify deep link normalization**

Run a local server and open:

```text
http://localhost:8000/?category=weather&tab=map&year=2019
```

Expected: no console error, catalog count still renders, URL remains valid.

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add js/routes.js js/main.js js/app-state.js
git commit -m "feat: add modular route state handling"
```

---

## Task 5: Extract Archive View And Details Panel

**Files:**

- Create: `js/archive-view.js`
- Modify: `js/main.js`
- Modify: `js/app-state.js`

- [ ] **Step 1: Create `js/archive-view.js` by moving archive rendering from `app.js`**

Move these existing `app.js` responsibilities into named exports:

- `updateMeta(state, els)`
- `renderWaveform(state, els, track)`
- `renderVariantAlternates(state, els, actions, track)`
- `renderTrackDetail(state, els, actions)`
- `openTrackDetail(els)`
- `closeTrackDetail(els)`
- `copySourceUrl(state, els)`
- `buildFilters(state, els, actions)`
- `renderTrackList(state, els, actions)`
- `highlightCurrent(state, els)`
- `syncControlsFromState(state, els)`

The module must import pure helpers:

```js
import {
  CATEGORY_LABELS,
  SORT_LABELS,
  buildTrackDetail,
  formatCount,
  formatDate,
  trackId,
} from '../app-core.mjs';

import {
  categoryList,
  currentAudioArtifact,
  currentTrack,
  recomputeVisible,
  sanctuaryList,
} from './app-state.js';

import { syncUrl } from './routes.js';
```

The `actions` object passed into rendering functions must provide these callbacks:

```js
{
  renderAll,
  setTrack,
  setTab,
  playPause,
}
```

- [ ] **Step 2: Preserve filter behavior**

When moving `buildFilters`, keep these exact state transitions:

```js
state.category = category;
recomputeVisible(state);
syncUrl(state, 'pushState');
actions.renderAll();
```

For search input:

```js
state.query = els.query.value;
recomputeVisible(state);
syncUrl(state);
actions.renderAll();
```

For sanctuary and sort selects:

```js
state.sanctuary = els.sanctuarySelect.value;
recomputeVisible(state);
syncUrl(state, 'pushState');
actions.renderAll();
```

```js
state.sort = els.sortSelect.value;
recomputeVisible(state);
syncUrl(state, 'pushState');
actions.renderAll();
```

- [ ] **Step 3: Add focus return in `closeTrackDetail`**

Use:

```js
export function closeTrackDetail(els) {
  els.detailPanel.hidden = true;
  els.detailsButton.setAttribute('aria-expanded', 'false');
  els.detailsButton.focus();
}
```

- [ ] **Step 4: Wire archive rendering in `js/main.js`**

Import:

```js
import {
  buildFilters,
  closeTrackDetail,
  copySourceUrl,
  highlightCurrent,
  openTrackDetail,
  renderTrackDetail,
  renderTrackList,
  syncControlsFromState,
  updateMeta,
} from './archive-view.js';
```

Create a `renderAll()` function in `main.js`:

```js
function renderAll() {
  syncControlsFromState(state, els);
  updateMeta(state, els);
  buildFilters(state, els, actions);
  renderTrackList(state, els, actions);
  renderTrackDetail(state, els, actions);
  highlightCurrent(state, els);
}
```

- [ ] **Step 5: Verify archive behavior**

Run local server and verify:

- first track metadata renders
- category buttons render
- search updates result count
- detail panel opens and closes
- close returns focus to the details button

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add js/archive-view.js js/main.js js/app-state.js
git commit -m "feat: extract archive view module"
```

---

## Task 6: Extract Player Module

**Files:**

- Create: `js/player.js`
- Modify: `js/main.js`
- Modify: `js/archive-view.js`

- [ ] **Step 1: Create `js/player.js`**

Move these functions from `app.js`:

- `setPlayingState(state, els, value)`
- `mediaUrl(track)`
- `setTrack(state, els, actions, index, options = {})`
- `playPause(state, els)`
- `navigate(state, els, actions, delta)`
- `shuffleOrder(state, els, actions)`
- `updateProgress(els)`
- `formatTime(seconds)`
- `bindPlayerEvents(state, els, actions)`

Use these imports:

```js
import { currentTrack, recomputeVisible } from './app-state.js';
import { syncUrl } from './routes.js';
```

Preserve existing `app.js` playback behavior:

```js
export function mediaUrl(track) {
  return track ? track.url : '';
}
```

For failed playback, keep a useful status:

```js
els.status.textContent = 'Audio could not be played from the remote archive.';
```

- [ ] **Step 2: Keep normal progress updates out of noisy live regions**

`updateProgress()` should update `els.time` and `els.progress`, but it should not write to `els.status` on every `timeupdate`.

- [ ] **Step 3: Wire player actions in `main.js`**

The `actions` object should include:

```js
const actions = {
  renderAll,
  setTrack: (index, options) => setTrack(state, els, actions, index, options),
  setTab: (tabName, options) => setTab(state, els, actions, tabName, options),
  playPause: () => playPause(state, els),
  navigate: delta => navigate(state, els, actions, delta),
};
```

Call:

```js
bindPlayerEvents(state, els, actions);
```

- [ ] **Step 4: Verify player UI behavior**

Run local server and verify:

- previous and next update active track
- shuffle toggles active state
- progress range remains stable
- clicking play updates icon/state or reports remote playback failure

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add js/player.js js/main.js js/archive-view.js
git commit -m "feat: extract player controls"
```

---

## Task 7: Extract Map, Live, And Spectrogram Views

**Files:**

- Create: `js/map-view.js`
- Create: `js/live-view.js`
- Create: `js/spectrogram-view.js`
- Modify: `js/main.js`
- Modify: `index.html`

- [ ] **Step 1: Create `js/map-view.js`**

Move these map functions from `app.js`:

- `initLeafletMap(state, els)`
- `markerHtml(pin)`
- `popupHtml(pin)`
- `renderMap(state, els, actions)`

Use core imports:

```js
import {
  CATEGORY_LABELS,
  buildFilteredMapPins,
  buildMapPinSummary,
  formatCount,
} from '../app-core.mjs';

import { currentTrack, recomputeVisible, yearList } from './app-state.js';
import { syncUrl } from './routes.js';
```

If `window.L` is unavailable, render:

```js
els.mapSummary.textContent = 'Map assets are unavailable. The recording catalog is still usable from the Archive tab.';
```

- [ ] **Step 2: Create `js/live-view.js`**

Move live rendering from `app.js` and import:

```js
import { buildLiveSourceCards } from '../app-core.mjs';
```

At the top of the live panel render, include card or note copy:

```text
Live and near-live sources are separate from the historical NOAA SanctSound archive. Availability, latency, and playback support depend on the source.
```

- [ ] **Step 3: Create `js/spectrogram-view.js`**

Move `renderSpectrogram()` from `app.js` and import:

```js
import { buildSpectrogramPath } from '../app-core.mjs';
import { currentTrack } from './app-state.js';
```

Preserve missing-image behavior:

```js
els.spectrogramImg.hidden = true;
els.spectrogramEmpty.hidden = false;
```

- [ ] **Step 4: Wire tabs in `main.js`**

Implement:

```js
function setTab(state, els, actions, tabName, options = {}) {
  state.activeTab = tabName;
  for (const tab of els.tabs) {
    const selected = tab.dataset.tab === tabName;
    tab.classList.toggle('on', selected);
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
  }
  els.archivePanel.hidden = tabName !== 'archive';
  els.mapPanel.hidden = tabName !== 'map';
  els.livePanel.hidden = tabName !== 'live';
  els.spectrogramPanel.hidden = tabName !== 'spectrogram';
  syncUrl(state, options.history || 'replaceState');
  actions.renderAll();
}
```

Bind each tab click:

```js
for (const tab of els.tabs) {
  tab.addEventListener('click', () => actions.setTab(tab.dataset.tab, { history: 'pushState' }));
}
```

Add arrow-key tab behavior:

```js
for (const [index, tab] of els.tabs.entries()) {
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const last = els.tabs.length - 1;
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowRight'
          ? Math.min(last, index + 1)
          : Math.max(0, index - 1);
    els.tabs[nextIndex].focus();
    actions.setTab(els.tabs[nextIndex].dataset.tab, { history: 'pushState' });
  });
}
```

- [ ] **Step 5: Verify all tabs**

Run local server and verify:

- Archive tab renders list
- Map tab renders markers or fallback
- Live tab renders separate-source copy
- Spectrogram tab renders image or empty state
- Arrow keys move across tabs

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add js/map-view.js js/live-view.js js/spectrogram-view.js js/main.js index.html
git commit -m "feat: extract secondary explorer views"
```

---

## Task 8: Delete Legacy `app.js` And Align Service Worker

**Files:**

- Delete: `app.js`
- Modify: `sw.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`

- [ ] **Step 1: Update app-core cache manifest test**

Change the expected manifest in `tests/app-core.test.mjs` so it includes module files:

```js
assert.deepEqual(buildStaticCacheManifest().slice(0, 10), [
  './',
  './index.html',
  './sounds.js',
  './sanctuaries.js',
  './live-sources.js',
  './audio-artifacts.js',
  './catalog-overrides.json',
  './site.webmanifest',
  './js/main.js',
  './js/app-state.js',
]);
```

- [ ] **Step 2: Update `buildStaticCacheManifest()`**

Return:

```js
return [
  './',
  './index.html',
  './sounds.js',
  './sanctuaries.js',
  './live-sources.js',
  './audio-artifacts.js',
  './catalog-overrides.json',
  './site.webmanifest',
  './js/main.js',
  './js/app-state.js',
  './js/archive-view.js',
  './js/dom.js',
  './js/live-view.js',
  './js/map-view.js',
  './js/player.js',
  './js/routes.js',
  './js/service-worker.js',
  './js/spectrogram-view.js',
  './app-core.mjs',
];
```

- [ ] **Step 3: Update `sw.js` APP_SHELL**

Make `APP_SHELL` match the list from `buildStaticCacheManifest()`.

- [ ] **Step 4: Delete `app.js`**

Run:

```bash
git rm app.js
```

- [ ] **Step 5: Verify there are no references to `app.js`**

Run:

```bash
rg "app\\.js"
```

Expected: no references in runtime files. README references are allowed only if describing old history; prefer removing them.

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add app-core.mjs tests/app-core.test.mjs sw.js
git commit -m "refactor: remove legacy browser app bundle"
```

---

## Task 9: Add Catalog JSON Schema Validation

**Files:**

- Create: `catalog.schema.json`
- Create: `scripts/validate-catalog-schema.mjs`
- Modify: `tests/catalog.test.mjs`

- [ ] **Step 1: Create `catalog.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Ocean Jukebox Catalog",
  "type": "object",
  "required": ["title", "source", "baseUrl", "generatedAt", "archiveNote", "tracks"],
  "additionalProperties": true,
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "source": { "type": "string", "format": "uri" },
    "baseUrl": { "type": "string", "format": "uri" },
    "generatedAt": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" },
    "archiveNote": { "type": "string", "minLength": 1 },
    "tracks": {
      "type": "array",
      "items": { "$ref": "#/$defs/track" }
    }
  },
  "$defs": {
    "track": {
      "type": "object",
      "required": ["filename", "url", "sanctuary", "category", "label", "description"],
      "additionalProperties": true,
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "filename": { "type": "string", "minLength": 1 },
        "url": { "type": "string", "format": "uri" },
        "sanctuary": { "type": "string", "minLength": 1 },
        "category": {
          "type": "string",
          "enum": ["dolphin", "fish", "human", "invertebrate", "marine mammal", "soundscape", "vessel", "weather", "whale"]
        },
        "label": { "type": "string", "minLength": 1 },
        "description": { "type": "string", "minLength": 1 },
        "recordedAt": {
          "anyOf": [
            { "type": "null" },
            { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$" }
          ]
        },
        "site": {
          "anyOf": [
            { "type": "null" },
            { "type": "string", "pattern": "^[A-Z]{2}\\d{2}$" }
          ]
        },
        "deployment": {
          "anyOf": [
            { "type": "null" },
            { "type": "string", "pattern": "^\\d{2}$" }
          ]
        },
        "variant": { "type": "string", "enum": ["original", "enhanced"] },
        "groupKey": { "type": "string", "minLength": 1 },
        "sourceType": { "type": "string", "enum": ["audio", "video"] },
        "sourcePage": { "type": "string", "format": "uri" },
        "catalogedAt": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$" }
      }
    }
  }
}
```

- [ ] **Step 2: Create dependency-free schema validator script**

Implement a local validator for the schema subset used above: `type`, `required`, `properties`, `items`, `enum`, `pattern`, `anyOf`, `minLength`, and `$ref` to `#/$defs/track`.

The script must:

```js
import { readFile, writeFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../sounds.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../catalog.schema.json', import.meta.url), 'utf8'));
const errors = validateValue(catalog, schema, '$', schema);

await writeFile(
  new URL('../catalog-schema-report.json', import.meta.url),
  `${JSON.stringify({ ok: errors.length === 0, errors }, null, 2)}\n`,
);

console.log(`Catalog schema validation ${errors.length === 0 ? 'passed' : 'failed'}.`);
console.log(`Errors: ${errors.length}`);
if (errors.length) process.exitCode = 1;
```

The implementation must report paths like `$.tracks[4].filename` for failures.

- [ ] **Step 3: Add tests for schema validator helpers**

Export `validateValue` from `scripts/validate-catalog-schema.mjs` and add tests:

```js
import { validateValue } from '../scripts/validate-catalog-schema.mjs';

test('schema validator reports required and enum errors with paths', () => {
  const errors = validateValue(
    { category: 'mystery' },
    {
      type: 'object',
      required: ['filename', 'category'],
      properties: {
        filename: { type: 'string' },
        category: { type: 'string', enum: ['whale'] },
      },
    },
    '$',
    {},
  );

  assert.deepEqual(errors, [
    '$.filename is required.',
    '$.category must be one of: whale.',
  ]);
});
```

- [ ] **Step 4: Run validation**

Update `package.json`:

```json
"validate:catalog": "node scripts/validate-catalog.mjs && node scripts/validate-catalog-schema.mjs"
```

```bash
npm run validate:catalog
```

Expected:

```text
Catalog validation passed.
Catalog schema validation passed.
Errors: 0
```

- [ ] **Step 5: Commit**

```bash
git add catalog.schema.json catalog-schema-report.json scripts/validate-catalog-schema.mjs tests/catalog.test.mjs package.json
git commit -m "feat: add catalog schema validation"
```

---

## Task 10: Add Archive Source-Health Checker

**Files:**

- Create: `scripts/check-catalog-sources.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/check-catalog-sources.mjs`**

```js
import { readFile, writeFile } from 'node:fs/promises';

const catalogUrl = new URL('../sounds.json', import.meta.url);
const reportUrl = new URL('../catalog-source-report.json', import.meta.url);

function parseArgs(args) {
  const options = { limit: Infinity, timeoutMs: 12000 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--limit') {
      options.limit = Number(args[index + 1] || Infinity);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(args[index + 1] || 12000);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    }
  }
  if (!Number.isFinite(options.limit) || options.limit <= 0) options.limit = Infinity;
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) options.timeoutMs = 12000;
  return options;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSource(track, { timeoutMs = 12000 } = {}) {
  try {
    let response = await fetchWithTimeout(track.url, { method: 'HEAD' }, timeoutMs);
    let method = 'HEAD';
    if (response.status === 403 || response.status === 405 || response.status === 501) {
      response = await fetchWithTimeout(track.url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      }, timeoutMs);
      method = 'GET range';
    }
    return {
      filename: track.filename,
      url: track.url,
      ok: response.ok || response.status === 206,
      status: response.status,
      method,
    };
  } catch (error) {
    return {
      filename: track.filename,
      url: track.url,
      ok: false,
      status: 0,
      method: 'HEAD',
      error: error.message,
    };
  }
}

const options = parseArgs(process.argv.slice(2));
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const tracks = (catalog.tracks || []).slice(0, options.limit);
const checkedAt = new Date().toISOString();
const results = [];

for (const track of tracks) {
  results.push(await checkSource(track, options));
}

const report = {
  checkedAt,
  totalCatalogTracks: (catalog.tracks || []).length,
  checkedTracks: tracks.length,
  ok: results.every(result => result.ok),
  results,
};

await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);

const failed = results.filter(result => !result.ok);
console.log(`Checked ${results.length} catalog source${results.length === 1 ? '' : 's'}.`);
console.log(`Reachable: ${results.length - failed.length}`);
console.log(`Unavailable: ${failed.length}`);
if (failed.length) process.exitCode = 1;
```

- [ ] **Step 2: Run limited network check**

```bash
npm run check:catalog-sources -- --limit=3
```

Expected: writes `catalog-source-report.json` and prints checked/reachable/unavailable counts. If network is blocked, note that the script works but remote source availability could not be verified.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-catalog-sources.mjs catalog-source-report.json package.json
git commit -m "feat: add catalog source health check"
```

---

## Task 11: Add Browser Smoke Tests

**Files:**

- Create: `playwright.config.mjs`
- Create: `tests/browser-smoke.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create Playwright config**

```js
export default {
  testDir: './tests',
  testMatch: /browser-smoke\.test\.mjs/,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
};
```

- [ ] **Step 2: Create browser smoke test**

```js
import { test, expect } from '@playwright/test';

test('loads archive and filters recordings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#s-label')).not.toHaveText('Loading catalog');
  await expect(page.locator('#result-count')).toContainText('recording');

  const initialCount = await page.locator('[data-track-index]').count();
  expect(initialCount).toBeGreaterThan(0);

  await page.getByRole('button', { name: /weather/i }).click();
  await expect(page.locator('#result-count')).toContainText(/recording/);
  const filteredCount = await page.locator('[data-track-index]').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThanOrEqual(initialCount);
});

test('player controls update UI state without requiring remote audio success', async ({ page }) => {
  await page.goto('/');
  const play = page.locator('#btn-play');
  await play.click();
  await expect(page.locator('#status')).toContainText(/Loading|Playing|Audio could not be played|Paused/i);
});

test('map live and spectrogram tabs render stable states', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: /map/i }).click();
  await expect(page.locator('#map-panel')).toBeVisible();
  await expect(page.locator('#map-summary')).toBeVisible();

  await page.getByRole('tab', { name: /live/i }).click();
  await expect(page.locator('#live-panel')).toBeVisible();
  await expect(page.locator('#live-grid')).toContainText(/separate|source|MBARI/i);

  await page.getByRole('tab', { name: /spectrogram/i }).click();
  await expect(page.locator('#spectrogram-panel')).toBeVisible();
  await expect(page.locator('#spectrogram-empty').or(page.locator('#spectrogram-img'))).toBeVisible();
});
```

When rendering track rows in `archive-view.js`, ensure each row includes:

```js
row.dataset.trackIndex = String(index);
```

- [ ] **Step 3: Install Playwright dependency**

Run:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Expected: `package-lock.json` is created and Chromium browser is installed locally.

- [ ] **Step 4: Run browser smoke test**

```bash
npm run test:browser
```

Expected: all browser smoke tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json playwright.config.mjs tests/browser-smoke.test.mjs js/archive-view.js
git commit -m "test: add browser smoke coverage"
```

---

## Task 12: Product Polish, README, And Final Verification

**Files:**

- Modify: `index.html`
- Modify: `README.md`
- Modify: `sw.js`
- Modify: `js/live-view.js`
- Modify: `js/spectrogram-view.js`
- Modify: `js/player.js`
- Modify: `js/archive-view.js`

- [ ] **Step 1: Update offline shell copy in README**

Replace the offline shell section with:

```markdown
### Offline shell

When served over HTTP(S), `js/main.js` registers `sw.js`.
The service worker caches the static explorer shell and generated local metadata so the page can reopen without a network connection.
It does not cache NOAA archive audio, Leaflet map tiles, OpenStreetMap data, or CDN-hosted icon/map assets.
The Archive list can be inspected offline after a previous visit, but playback and map tiles still depend on their remote sources.
```

- [ ] **Step 2: Update generated asset README wording**

Add:

```markdown
Generated spectrogram and waveform image files are optional enhancements.
The player waveform uses checked-in preview peak data from `audio-artifacts.js` when media analysis has not been run.
The Spectrogram tab displays a generated PNG when present and otherwise shows a non-error empty state.
```

- [ ] **Step 3: Add Live tab note in `index.html`**

Inside `#live-panel`, keep:

```html
<p class="live-note">Live and near-live sources are separate from the historical NOAA SanctSound archive. Availability, latency, and playback support depend on the source.</p>
```

- [ ] **Step 4: Verify accessible labels**

Run:

```bash
rg "aria-label|aria-expanded|aria-selected|aria-live" index.html js
```

Confirm icon-only controls have labels:

- `btn-prev`: Previous track
- `btn-play`: Play or Pause
- `btn-next`: Next track
- `btn-shuffle`: Toggle shuffle
- `btn-details`: Track details
- `btn-detail-close`: Close details

- [ ] **Step 5: Run full verification**

```bash
npm test
npm run validate:catalog
npm run test:browser
npm run check:catalog-sources -- --limit=5
```

Expected:

- Node tests pass.
- Catalog custom validation passes.
- Catalog schema validation passes.
- Browser smoke tests pass.
- Source-health check either reports reachable NOAA URLs or reports network unavailability clearly.

- [ ] **Step 6: Inspect git status**

```bash
git status --short
```

Expected: only intended modernization files are changed.

- [ ] **Step 7: Commit**

```bash
git add README.md index.html sw.js js app-core.mjs tests scripts catalog.schema.json catalog-schema-report.json catalog-source-report.json package.json package-lock.json playwright.config.mjs .github/workflows/test.yml
git commit -m "docs: document modernization behavior"
```

---

## Completion Criteria

The implementation is complete when:

- `index.html` loads `./js/main.js` with `type="module"`.
- No runtime code references `app.js`.
- Browser modules import pure helpers from `app-core.mjs` instead of copying them.
- `npm test` passes.
- `npm run validate:catalog` passes.
- `npm run test:browser` passes.
- `npm run check:catalog-sources -- --limit=5` runs and writes a report.
- The Live tab clearly distinguishes external live sources from historical SanctSound clips.
- The README documents GitHub Pages/HTTP serving, offline shell limits, generated assets, schema validation, and source checks.
