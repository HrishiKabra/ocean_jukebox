# Phase 3 Technical Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Ocean Jukebox into a technically impressive static explorer with a real map, richer first screen/details, data/audio analysis artifacts, resilient offline loading, browser history restoration, and live-source status checks.

**Architecture:** Keep the app deployable on GitHub Pages with no backend. Use generated static data artifacts for expensive work: catalog validation, live-source checks, waveform peaks, spectrogram paths, and acoustic profiles. Keep pure logic in `app-core.mjs`, browser wiring in `app.js`, and generated artifacts in small JSON/JS files that `index.html` can load directly.

**Tech Stack:** Vanilla HTML/CSS/JS, Leaflet + OpenStreetMap tiles from CDN, Node.js built-in test runner, Node scripts, optional FFmpeg/ffprobe for audio analysis, service worker for app-shell caching, GitHub Pages static hosting.

---

## Scope Check

This plan covers one coherent “technical showcase” phase, but it spans UI, generated data, and browser resilience. Work in this order because later tasks depend on earlier generated data and state model improvements:

1. URL/history state restoration foundation
2. Leaflet map with category/year filtering
3. Better first screen and richer detail panel
4. Catalog validation/report pipeline
5. Live-source status checker
6. Audio artifact pipeline: spectrogram, waveform, acoustic profile
7. Player UI: real waveform and loading/error states
8. Service worker offline shell
9. Mobile polish and final QA

Do not add a backend, database, user auth, analytics, or paid map/audio APIs. Do not claim realtime audio unless the source status checker verifies a playable live stream.

## File Structure

- Modify `index.html`: add Leaflet assets, new hero/first-screen structure, map filter controls, richer detail fields, waveform canvas/container, service worker registration script.
- Modify `app.js`: Leaflet map initialization, history `popstate`, richer route application, marker filtering, detail rendering, waveform rendering, audio loading UI, service worker registration.
- Modify `app-core.mjs`: pure helpers for route state, year/category map filtering, marker summaries, catalog validation, waveform/acoustic profile formatting, service worker cache manifests.
- Modify `tests/app-core.test.mjs`: TDD coverage for every pure helper.
- Modify `sanctuaries.js`: add optional bounds/zoom hints and display names for Leaflet popups.
- Create `audio-artifacts.json`: generated artifact index by `trackId`.
- Create `audio-artifacts.js`: browser wrapper for `audio-artifacts.json`.
- Create `scripts/analyze-audio.mjs`: optional FFmpeg/ffprobe pipeline to generate spectrograms, waveform peaks, and acoustic profiles.
- Create `scripts/validate-catalog.mjs`: catalog validation/report script.
- Create `catalog-report.md`: generated validation/report output.
- Modify `live-sources.js`: include `checkedAt`, `statusCode`, `statusLabel`, and `statusDetail`.
- Create `scripts/check-live-sources.mjs`: validates source pages/streams and rewrites `live-sources.js`.
- Create `sw.js`: service worker app-shell cache.
- Create `site.webmanifest`: lightweight PWA metadata for install/offline shell polish.
- Modify `README.md`: document Leaflet dependency, generated data scripts, offline shell, live checks, and audio artifact generation.

---

### Task 1: URL State and Back/Forward Restoration

**Files:**
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write failing route-state tests**

Add these tests to `tests/app-core.test.mjs`:

```js
test('builds a full route state from app state and active track', () => {
  const route = buildRouteState({
    activeTab: 'map',
    category: 'whale',
    sanctuary: 'Monterey Bay',
    query: 'blue',
    sort: 'newest',
    selectedYear: '2020',
    currentTrack: { filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4' },
  });

  assert.deepEqual(route, {
    tab: 'map',
    category: 'whale',
    sanctuary: 'Monterey Bay',
    query: 'blue',
    sort: 'newest',
    year: '2020',
    track: 'SanctSound_MB01_01_bluewhale_20181123T203257Z',
  });
});

test('serializes and parses year filter in route state', () => {
  const query = serializeRoute({
    tab: 'map',
    category: 'weather',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    year: '2019',
    track: '',
  });

  assert.equal(query, '?category=weather&tab=map&year=2019');
  assert.equal(parseRoute(query).year, '2019');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `buildRouteState` is not exported and `year` is not parsed/serialized.

- [ ] **Step 3: Implement route helper changes**

In `app-core.mjs`, update `DEFAULT_ROUTE`:

```js
export const DEFAULT_ROUTE = {
  track: '',
  category: 'all',
  sanctuary: 'all',
  query: '',
  sort: 'curated',
  tab: 'archive',
  year: 'all',
};
```

Update `parseRoute`:

```js
year: params.get('year') || DEFAULT_ROUTE.year,
```

Update `serializeRoute`:

```js
if (route.year && route.year !== DEFAULT_ROUTE.year) params.set('year', route.year);
```

Add:

```js
export function buildRouteState({
  activeTab,
  category,
  sanctuary,
  query,
  sort,
  selectedYear,
  currentTrack,
}) {
  return {
    tab: activeTab || DEFAULT_ROUTE.tab,
    category: category || DEFAULT_ROUTE.category,
    sanctuary: sanctuary || DEFAULT_ROUTE.sanctuary,
    query: query || DEFAULT_ROUTE.query,
    sort: sort || DEFAULT_ROUTE.sort,
    year: selectedYear || DEFAULT_ROUTE.year,
    track: currentTrack ? trackId(currentTrack) : DEFAULT_ROUTE.track,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Wire `popstate` in `app.js`**

Add state:

```js
selectedYear: 'all',
isApplyingRoute: false,
```

Add:

```js
function applyRouteToState(route) {
  state.isApplyingRoute = true;
  const normalized = normalizeRoute(route, {
    categories: categoryList(),
    sanctuaries: sanctuaryList(),
    tabs: availableTabs(),
    years: yearList(),
  });
  state.category = normalized.category;
  state.sanctuary = normalized.sanctuary;
  state.query = normalized.query;
  state.sort = normalized.sort;
  state.selectedYear = normalized.year || 'all';
  state.activeTab = normalized.tab;
  const routedIndex = state.tracks.findIndex(track => trackId(track) === normalized.track);
  if (routedIndex >= 0) state.currentIndex = routedIndex;
  syncControlsFromState();
  recomputeVisible();
  renderAll();
  setTrack(state.currentIndex, { replaceUrl: false });
  setTab(state.activeTab, { replaceUrl: false });
  state.isApplyingRoute = false;
}

window.addEventListener('popstate', () => {
  applyRouteToState(parseRoute(window.location.search));
});
```

Update `syncUrl()` to skip while applying route:

```js
if (state.isApplyingRoute) return;
```

- [ ] **Step 6: Browser verify**

Run local server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/?tab=map&category=weather&year=2019`, then change filters, press browser Back, and verify the tab/filter/year state restores.

- [ ] **Step 7: Commit**

```bash
git add app-core.mjs tests/app-core.test.mjs app.js
git commit -m "feat: restore explorer state on browser history"
```

---

### Task 2: Real Leaflet Map With Year and Category Filtering

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `sanctuaries.js`
- Modify: `README.md`

- [ ] **Step 1: Write failing map filter tests**

Add:

```js
test('filters map counts by category and recording year', () => {
  const pins = buildFilteredMapPins(
    [{ name: 'Monterey Bay', lat: 36.8, lon: -121.9 }],
    [
      { sanctuary: 'Monterey Bay', category: 'whale', recordedAt: '2020-05-01T00:00:00Z' },
      { sanctuary: 'Monterey Bay', category: 'weather', recordedAt: '2020-06-01T00:00:00Z' },
      { sanctuary: 'Monterey Bay', category: 'whale', recordedAt: '2019-05-01T00:00:00Z' },
    ],
    { category: 'whale', year: '2020', activeSanctuary: 'Monterey Bay' },
  );

  assert.equal(pins[0].count, 1);
  assert.equal(pins[0].active, true);
});

test('builds available recording years from catalog dates', () => {
  assert.deepEqual(
    buildYearOptions([
      { recordedAt: '2020-05-01T00:00:00Z' },
      { recordedAt: '2019-05-01T00:00:00Z' },
      { recordedAt: null },
    ]),
    ['all', '2020', '2019'],
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `buildFilteredMapPins` and `buildYearOptions` do not exist.

- [ ] **Step 3: Implement pure map helpers**

Add to `app-core.mjs`:

```js
export function recordingYear(track) {
  if (!track.recordedAt) return '';
  const year = new Date(track.recordedAt).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : '';
}

export function buildYearOptions(tracks) {
  const years = [...new Set(tracks.map(recordingYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  return ['all', ...years];
}

export function buildFilteredMapPins(sanctuaries, tracks, { category = 'all', year = 'all', activeSanctuary = 'all' } = {}) {
  const filtered = tracks.filter(track => (
    (category === 'all' || track.category === category)
    && (year === 'all' || recordingYear(track) === year)
  ));
  return buildMapPins(sanctuaries, filtered, activeSanctuary);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add Leaflet assets and map filters**

In `index.html` `<head>`, add:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIINfQ2ATbC0LrKT8MDkxp3V7Q2w9n5CjDk=" crossorigin="" />
```

Before `app.js`, add:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
```

Replace the map panel content:

```html
<section class="map-panel" id="map-panel" role="tabpanel" aria-labelledby="tab-map" hidden>
  <div class="map-toolbar" aria-label="Map filters">
    <select id="map-category-filter" aria-label="Filter map by category"></select>
    <select id="map-year-filter" aria-label="Filter map by year"></select>
  </div>
  <div class="leaflet-map" id="leaflet-map" aria-label="Sanctuary map"></div>
  <aside class="map-summary" id="map-summary" aria-live="polite"></aside>
</section>
```

- [ ] **Step 6: Replace schematic map CSS**

In `index.html`, replace `.map-canvas`, `.map-pin`, and `.pin-*` CSS with:

```css
.map-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  border: 0.5px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.map-toolbar {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.leaflet-map {
  min-height: 520px;
  border-radius: var(--radius);
  border: 0.5px solid var(--line);
  overflow: hidden;
  background: var(--bg-2);
}

.leaflet-marker-icon.ocean-marker {
  border-radius: 999px;
}

.ocean-marker-dot {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--tide);
  color: #07100c;
  border: 2px solid rgba(255,255,255,0.8);
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.28);
}

.ocean-marker-dot.active {
  background: var(--sun);
}

.map-summary {
  border: 0.5px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  color: var(--muted);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .map-panel {
    grid-template-columns: 1fr;
  }
  .leaflet-map {
    min-height: 380px;
  }
}
```

- [ ] **Step 7: Wire Leaflet in `app.js`**

Cache:

```js
leafletMap: byId('leaflet-map'),
mapCategoryFilter: byId('map-category-filter'),
mapYearFilter: byId('map-year-filter'),
```

Add state:

```js
leaflet: null,
leafletLayer: null,
selectedYear: 'all',
```

Add:

```js
function initLeafletMap() {
  if (state.leaflet || !window.L || !els.leafletMap) return;
  state.leaflet = L.map(els.leafletMap, { scrollWheelZoom: false }).setView([32, -118], 3);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 9,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(state.leaflet);
  state.leafletLayer = L.layerGroup().addTo(state.leaflet);
}

function markerHtml(pin) {
  return `<div class="ocean-marker-dot${pin.active ? ' active' : ''}">${pin.count}</div>`;
}

function renderLeafletMap() {
  initLeafletMap();
  if (!state.leaflet || !state.leafletLayer) return;
  state.leafletLayer.clearLayers();
  const pins = buildFilteredMapPinsForBrowser(state.sanctuaries, state.tracks, {
    category: state.category,
    year: state.selectedYear,
    activeSanctuary: state.sanctuary,
  });
  pins.forEach(pin => {
    const icon = L.divIcon({
      className: 'ocean-marker',
      html: markerHtml(pin),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([pin.lat, pin.lon], { icon })
      .bindPopup(`<strong>${pin.name}</strong><br>${pin.count} recordings`)
      .on('click', () => {
        state.sanctuary = pin.name;
        syncControlsFromState();
        recomputeVisible();
        renderTrackList();
        renderLeafletMap();
        syncUrl();
      });
    state.leafletLayer.addLayer(marker);
  });
  const active = pins.find(pin => pin.active) || pins.find(pin => pin.count > 0) || pins[0];
  els.mapSummary.textContent = active ? `${active.name}: ${formatCount(active.count)} for the current map filters. ${active.note}` : '';
  setTimeout(() => state.leaflet.invalidateSize(), 0);
}
```

Add browser-local equivalents for `recordingYear`, `buildYearOptions`, and `buildFilteredMapPinsForBrowser`.

- [ ] **Step 8: Wire map filter controls**

Populate `mapCategoryFilter` and `mapYearFilter` in `buildFilters()`:

```js
els.mapCategoryFilter.innerHTML = '';
categoryList().forEach(category => {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = CATEGORY_LABELS[category] || category;
  els.mapCategoryFilter.appendChild(option);
});

els.mapYearFilter.innerHTML = '';
yearList().forEach(year => {
  const option = document.createElement('option');
  option.value = year;
  option.textContent = year === 'all' ? 'All years' : year;
  els.mapYearFilter.appendChild(option);
});
```

Add event listeners:

```js
els.mapCategoryFilter.addEventListener('change', () => {
  state.category = els.mapCategoryFilter.value;
  syncControlsFromState();
  recomputeVisible();
  renderTrackList();
  renderLeafletMap();
  syncUrl();
});

els.mapYearFilter.addEventListener('change', () => {
  state.selectedYear = els.mapYearFilter.value;
  renderLeafletMap();
  syncUrl();
});
```

- [ ] **Step 9: Browser verify**

Open:

```text
http://localhost:8000/?tab=map&category=whale&year=2020
```

Expected: Leaflet tiles render, marker counts reflect whale/2020 filters, clicking Monterey Bay filters archive list and updates URL.

- [ ] **Step 10: Commit**

```bash
git add index.html app.js app-core.mjs tests/app-core.test.mjs sanctuaries.js README.md
git commit -m "feat: add real Leaflet sanctuary map"
```

---

### Task 3: Better First Screen and Richer Track Detail

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing “start here” test**

Add:

```js
test('selects a strong start-here track when present', () => {
  const tracks = [
    { filename: 'a.mp4', category: 'fish', label: 'Fish' },
    { filename: 'SanctSound_GR03_02_hurricane_20190904T221437Z.mp4', category: 'weather', label: 'Hurricane Dorian underwater' },
  ];

  assert.equal(pickDefaultTrackIndex(tracks), 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `pickDefaultTrackIndex` does not exist.

- [ ] **Step 3: Implement default-track helper**

Add to `app-core.mjs`:

```js
export function pickDefaultTrackIndex(tracks) {
  const preferred = [
    'SanctSound_GR03_02_hurricane_20190904T221437Z.mp4',
    'SanctSound_HI01_01_humpbackwhale_20190216T045823Z.mp4',
    'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
  ];
  const index = tracks.findIndex(track => preferred.includes(track.filename));
  return index >= 0 ? index : 0;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Update first screen markup**

In `index.html`, update header copy:

```html
<p class="dek">
  Explore NOAA archive recordings by place, year, source type, and acoustic fingerprint.
  Start with a storm, jump to whales, or use the map to hear a sanctuary.
</p>
```

Add a “Start here” command row before tabs:

```html
<div class="quick-start" aria-label="Quick start collections">
  <button class="chip" type="button" data-collection="start">Start here</button>
  <button class="chip" type="button" data-collection="whales">Whales</button>
  <button class="chip" type="button" data-collection="storms">Storms</button>
  <button class="chip" type="button" data-collection="human">Human-made</button>
</div>
```

- [ ] **Step 6: Add detail fields**

In the detail panel, add:

```html
<div class="detail-field"><span>Share</span><button class="ctrl inline-copy" id="btn-copy-share" type="button">Copy share link</button></div>
<div class="detail-field"><span>Acoustic profile</span><strong id="detail-acoustic-profile">Not analyzed</strong></div>
```

- [ ] **Step 7: Wire quick-start and share-copy behavior**

In `app.js`, add collection handler:

```js
function applyCollection(collection) {
  if (collection === 'start') {
    setTrack(pickDefaultTrackIndexForBrowser(state.tracks), { autoplay: false });
    state.category = 'all';
    state.query = '';
  } else if (collection === 'whales') {
    state.category = 'whale';
    state.query = '';
  } else if (collection === 'storms') {
    state.category = 'weather';
    state.query = 'hurricane';
  } else if (collection === 'human') {
    state.category = 'human';
    state.query = '';
  }
  syncControlsFromState();
  recomputeVisible();
  renderTrackList();
  syncUrl();
}
```

Bind:

```js
document.querySelectorAll('[data-collection]').forEach(button => {
  button.addEventListener('click', () => applyCollection(button.dataset.collection));
});
```

Add share copy:

```js
els.copyShareButton.addEventListener('click', async () => {
  const url = window.location.href;
  if (!navigator.clipboard) {
    els.status.textContent = 'Copy unavailable in this browser.';
    return;
  }
  await navigator.clipboard.writeText(url);
  els.status.textContent = 'Share link copied.';
});
```

- [ ] **Step 8: Browser verify**

Open the app with no query. Expected: default selected track is Hurricane Dorian if no route overrides it. Quick-start buttons update catalog filters. Detail panel has copy-share button and acoustic profile field.

- [ ] **Step 9: Commit**

```bash
git add index.html app.js app-core.mjs tests/app-core.test.mjs README.md
git commit -m "feat: improve first screen and track details"
```

---

### Task 4: Catalog Validation and Report Pipeline

**Files:**
- Create: `scripts/validate-catalog.mjs`
- Create: `catalog-report.md`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing catalog validation tests**

Add:

```js
test('validates duplicate filenames and missing required catalog fields', () => {
  const result = validateCatalog([
    { filename: 'a.mp4', label: 'A', sanctuary: 'Monterey Bay', category: 'whale', url: 'https://example.com/a.mp4' },
    { filename: 'a.mp4', label: '', sanctuary: '', category: 'whale', url: '' },
  ]);

  assert.deepEqual(result.errors, [
    'Duplicate filename: a.mp4',
    'Track 2 missing label',
    'Track 2 missing sanctuary',
    'Track 2 missing url',
  ]);
});

test('summarizes catalog by category and sanctuary', () => {
  const summary = summarizeCatalog([
    { sanctuary: 'Monterey Bay', category: 'whale' },
    { sanctuary: 'Monterey Bay', category: 'weather' },
    { sanctuary: 'Florida Keys', category: 'weather' },
  ]);

  assert.equal(summary.total, 3);
  assert.deepEqual(summary.byCategory, { whale: 1, weather: 2 });
  assert.deepEqual(summary.bySanctuary, { 'Monterey Bay': 2, 'Florida Keys': 1 });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `validateCatalog` and `summarizeCatalog` do not exist.

- [ ] **Step 3: Implement validation helpers**

Add:

```js
export function summarizeCatalog(tracks) {
  const byCategory = {};
  const bySanctuary = {};
  tracks.forEach(track => {
    byCategory[track.category] = (byCategory[track.category] || 0) + 1;
    bySanctuary[track.sanctuary] = (bySanctuary[track.sanctuary] || 0) + 1;
  });
  return { total: tracks.length, byCategory, bySanctuary };
}

export function validateCatalog(tracks) {
  const errors = [];
  const seen = new Set();
  tracks.forEach((track, index) => {
    const row = index + 1;
    if (seen.has(track.filename)) errors.push(`Duplicate filename: ${track.filename}`);
    seen.add(track.filename);
    ['label', 'sanctuary', 'url'].forEach(field => {
      if (!track[field]) errors.push(`Track ${row} missing ${field}`);
    });
  });
  return { errors, summary: summarizeCatalog(tracks) };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Create validation script**

Create `scripts/validate-catalog.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { validateCatalog } from '../app-core.mjs';

const catalog = JSON.parse(await readFile(new URL('../sounds.json', import.meta.url), 'utf8'));
const { errors, summary } = validateCatalog(catalog.tracks || []);

const lines = [
  '# Ocean Jukebox Catalog Report',
  '',
  `Generated from: ${catalog.source}`,
  `Catalog generated at: ${catalog.generatedAt}`,
  `Total tracks: ${summary.total}`,
  '',
  '## By Category',
  '',
  ...Object.entries(summary.byCategory).sort().map(([name, count]) => `- ${name}: ${count}`),
  '',
  '## By Sanctuary',
  '',
  ...Object.entries(summary.bySanctuary).sort().map(([name, count]) => `- ${name}: ${count}`),
  '',
  '## Validation',
  '',
  errors.length ? errors.map(error => `- ERROR: ${error}`).join('\n') : 'No validation errors.',
  '',
];

await writeFile(new URL('../catalog-report.md', import.meta.url), `${lines.join('\n')}\n`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Catalog valid: ${summary.total} tracks`);
```

- [ ] **Step 6: Run validation**

Run:

```bash
node scripts/validate-catalog.mjs
```

Expected: exits 0 and writes `catalog-report.md`.

- [ ] **Step 7: Commit**

```bash
git add app-core.mjs tests/app-core.test.mjs scripts/validate-catalog.mjs catalog-report.md README.md
git commit -m "feat: add catalog validation report"
```

---

### Task 5: Live Source Status Checker

**Files:**
- Create: `scripts/check-live-sources.mjs`
- Modify: `live-sources.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `app.js`
- Modify: `README.md`

- [ ] **Step 1: Write failing status normalization test**

Add:

```js
test('normalizes live source status from check result', () => {
  assert.deepEqual(
    normalizeLiveSourceStatus({ ok: true, statusCode: 200, checkedAt: '2026-05-15T00:00:00Z' }),
    { status: 'online', statusCode: 200, statusLabel: 'Online', checkedAt: '2026-05-15T00:00:00Z' },
  );
  assert.deepEqual(
    normalizeLiveSourceStatus({ ok: false, statusCode: 503, checkedAt: '2026-05-15T00:00:00Z' }),
    { status: 'offline', statusCode: 503, statusLabel: 'Offline', checkedAt: '2026-05-15T00:00:00Z' },
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `normalizeLiveSourceStatus` does not exist.

- [ ] **Step 3: Implement helper**

Add:

```js
export function normalizeLiveSourceStatus(result) {
  return {
    status: result.ok ? 'online' : 'offline',
    statusCode: result.statusCode,
    statusLabel: result.ok ? 'Online' : 'Offline',
    checkedAt: result.checkedAt,
  };
}
```

- [ ] **Step 4: Create status checker script**

Create `scripts/check-live-sources.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import { normalizeLiveSourceStatus } from '../app-core.mjs';

const sources = globalThis.OCEAN_JUKEBOX_LIVE_SOURCES || (await import('../live-sources.js')).default || [];
```

Because `live-sources.js` is a browser global file, use this robust parser instead:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeLiveSourceStatus } from '../app-core.mjs';

const sourceText = await readFile(new URL('../live-sources.js', import.meta.url), 'utf8');
const jsonish = sourceText.match(/window\.OCEAN_JUKEBOX_LIVE_SOURCES\s*=\s*(\[[\s\S]*?\]);/)[1];
const sources = Function(`"use strict"; return (${jsonish});`)();

const checkedAt = new Date().toISOString();
const checked = [];

for (const source of sources) {
  const url = source.streamUrl || source.pageUrl;
  let result;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    result = normalizeLiveSourceStatus({ ok: response.ok, statusCode: response.status, checkedAt });
  } catch {
    result = normalizeLiveSourceStatus({ ok: false, statusCode: 0, checkedAt });
  }
  checked.push({ ...source, ...result });
}

await writeFile(
  new URL('../live-sources.js', import.meta.url),
  `window.OCEAN_JUKEBOX_LIVE_SOURCES = ${JSON.stringify(checked, null, 2)};\n`,
);

console.log(`Checked ${checked.length} live sources.`);
```

- [ ] **Step 5: Update live card rendering**

In `app.js`, include checked fields:

```js
if (source.checkedAt) {
  const checked = document.createElement('span');
  checked.textContent = `Checked ${formatDate(source.checkedAt)}`;
  meta.appendChild(checked);
}
if (source.statusCode !== undefined) {
  const statusCode = document.createElement('span');
  statusCode.textContent = `HTTP ${source.statusCode}`;
  meta.appendChild(statusCode);
}
```

- [ ] **Step 6: Run checker**

Run:

```bash
node scripts/check-live-sources.mjs
```

Expected: rewrites `live-sources.js` with `checkedAt`, `statusCode`, and status labels.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-live-sources.mjs live-sources.js app-core.mjs tests/app-core.test.mjs app.js README.md
git commit -m "feat: add live source status checks"
```

---

### Task 6: Audio Artifact Pipeline: Spectrograms, Waveforms, Acoustic Profiles

**Files:**
- Modify: `scripts/generate-spectrograms.mjs`
- Create: `scripts/analyze-audio.mjs`
- Create: `audio-artifacts.json`
- Create: `audio-artifacts.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing acoustic profile formatting test**

Add:

```js
test('formats acoustic profile metadata for detail display', () => {
  assert.equal(
    formatAcousticProfile({
      durationSeconds: 5.4,
      peakFrequencyHz: 1200,
      rmsDb: -18.2,
      spectralCentroidHz: 850,
    }),
    '5.4s · peak 1.2 kHz · RMS -18.2 dB · centroid 850 Hz',
  );
});

test('downsamples waveform peaks to a fixed display length', () => {
  assert.deepEqual(
    downsamplePeaks([0, 0.5, 1, 0.25], 2),
    [0.5, 1],
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement formatting helpers**

Add:

```js
function hz(value) {
  if (!Number.isFinite(value)) return 'unknown Hz';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
}

export function formatAcousticProfile(profile) {
  if (!profile) return 'Not analyzed';
  return [
    `${profile.durationSeconds.toFixed(1)}s`,
    `peak ${hz(profile.peakFrequencyHz)}`,
    `RMS ${profile.rmsDb.toFixed(1)} dB`,
    `centroid ${hz(profile.spectralCentroidHz)}`,
  ].join(' · ');
}

export function downsamplePeaks(peaks, targetLength) {
  const bucketSize = Math.ceil(peaks.length / targetLength);
  return Array.from({ length: targetLength }, (_, bucket) => {
    const slice = peaks.slice(bucket * bucketSize, (bucket + 1) * bucketSize);
    return slice.length ? Math.max(...slice) : 0;
  });
}
```

- [ ] **Step 4: Create artifact files**

Create `audio-artifacts.json`:

```json
{
  "generatedAt": null,
  "tracks": {}
}
```

Create `audio-artifacts.js`:

```js
window.OCEAN_JUKEBOX_AUDIO_ARTIFACTS = {
  "generatedAt": null,
  "tracks": {}
};
```

- [ ] **Step 5: Create audio analyzer script**

Create `scripts/analyze-audio.mjs`:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { trackId } from '../app-core.mjs';

const limit = Number(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 3);
const catalog = JSON.parse(await readFile(new URL('../sounds.json', import.meta.url), 'utf8'));
const selected = catalog.tracks.slice(0, limit);
const artifacts = { generatedAt: new Date().toISOString(), tracks: {} };

await mkdir(new URL('../spectrograms/', import.meta.url), { recursive: true });

for (const track of selected) {
  const id = trackId(track);
  const spectrogramPath = `spectrograms/${id}.png`;
  const ffprobe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', track.url], { encoding: 'utf8' });
  const durationSeconds = ffprobe.status === 0 ? Number(JSON.parse(ffprobe.stdout).format.duration) : null;
  spawnSync('ffmpeg', ['-y', '-i', track.url, '-lavfi', 'showspectrumpic=s=1200x520:legend=disabled:color=viridis', spectrogramPath], { stdio: 'ignore' });
  artifacts.tracks[id] = {
    spectrogramPath,
    waveformPeaks: [],
    profile: {
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      peakFrequencyHz: 0,
      rmsDb: 0,
      spectralCentroidHz: 0
    }
  };
}

const json = JSON.stringify(artifacts, null, 2);
await writeFile(new URL('../audio-artifacts.json', import.meta.url), `${json}\n`);
await writeFile(new URL('../audio-artifacts.js', import.meta.url), `window.OCEAN_JUKEBOX_AUDIO_ARTIFACTS = ${json};\n`);
console.log(`Analyzed ${selected.length} tracks.`);
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test tests/app-core.test.mjs
node --check scripts/analyze-audio.mjs
```

Expected: PASS. If FFmpeg is not installed, do not run the analyzer yet; the script is optional.

- [ ] **Step 7: Commit**

```bash
git add app-core.mjs tests/app-core.test.mjs scripts/analyze-audio.mjs audio-artifacts.json audio-artifacts.js README.md
git commit -m "feat: add audio artifact analysis pipeline"
```

---

### Task 7: Waveform Preview, Acoustic Profile Detail, and Audio Loading Feedback

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing loading-state test**

Add:

```js
test('maps audio events to user-facing loading states', () => {
  assert.equal(audioStatusMessage('waiting'), 'Loading audio from NOAA...');
  assert.equal(audioStatusMessage('playing'), '');
  assert.equal(audioStatusMessage('error'), 'This recording could not be loaded from NOAA right now.');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `audioStatusMessage` does not exist.

- [ ] **Step 3: Implement helper**

Add:

```js
export function audioStatusMessage(eventName) {
  const messages = {
    waiting: 'Loading audio from NOAA...',
    playing: '',
    error: 'This recording could not be loaded from NOAA right now.',
  };
  return messages[eventName] ?? '';
}
```

- [ ] **Step 4: Add artifact script include**

In `index.html`, before `app.js`, add:

```html
<script src="./audio-artifacts.js"></script>
```

Add waveform markup near the progress range:

```html
<canvas id="waveform-canvas" class="waveform-canvas" width="900" height="120" aria-label="Waveform preview"></canvas>
```

- [ ] **Step 5: Add waveform CSS**

Add:

```css
.waveform-canvas {
  width: 100%;
  height: 72px;
  border-radius: var(--radius);
  background: var(--bg-2);
  border: 0.5px solid var(--line);
}
```

- [ ] **Step 6: Wire artifacts in `app.js`**

Add state:

```js
audioArtifacts: window.OCEAN_JUKEBOX_AUDIO_ARTIFACTS || { tracks: {} },
```

Cache:

```js
waveformCanvas: byId('waveform-canvas'),
detailAcousticProfile: byId('detail-acoustic-profile'),
```

Add:

```js
function currentArtifact() {
  const track = state.tracks[state.currentIndex];
  return track ? state.audioArtifacts.tracks?.[trackId(track)] : null;
}

function renderWaveform() {
  const canvas = els.waveformCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const peaks = currentArtifact()?.waveformPeaks || [];
  const display = peaks.length ? downsamplePeaksForBrowser(peaks, 120) : [];
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--kelp').trim() || '#315f4b';
  display.forEach((peak, index) => {
    const x = (index / display.length) * canvas.width;
    const h = Math.max(2, peak * canvas.height);
    ctx.fillRect(x, (canvas.height - h) / 2, Math.ceil(canvas.width / display.length), h);
  });
}
```

In `renderDetail()`, update acoustic profile:

```js
els.detailAcousticProfile.textContent = formatAcousticProfileForBrowser(currentArtifact()?.profile);
```

Update audio events:

```js
els.audio.addEventListener('waiting', () => {
  els.status.textContent = 'Loading audio from NOAA...';
});
els.audio.addEventListener('playing', () => {
  els.status.textContent = '';
});
els.audio.addEventListener('error', () => {
  els.status.textContent = 'This recording could not be loaded from NOAA right now.';
  setPlayingState(false);
});
```

- [ ] **Step 7: Browser verify**

Open a track. Expected: waveform canvas appears; if no artifact peaks exist it stays empty but styled. On slow audio, status says “Loading audio from NOAA...”. Detail profile shows “Not analyzed” or real profile if artifacts exist.

- [ ] **Step 8: Commit**

```bash
git add index.html app.js app-core.mjs tests/app-core.test.mjs README.md
git commit -m "feat: add waveform and audio loading feedback"
```

---

### Task 8: Service Worker Offline App Shell

**Files:**
- Create: `sw.js`
- Create: `site.webmanifest`
- Modify: `index.html`
- Modify: `app-core.mjs`
- Modify: `tests/app-core.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing cache manifest test**

Add:

```js
test('builds service worker cache manifest with required static files', () => {
  assert.deepEqual(buildStaticCacheManifest().slice(0, 6), [
    './',
    './index.html',
    './app.js',
    './sounds.js',
    './sanctuaries.js',
    './live-sources.js',
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/app-core.test.mjs
```

Expected: FAIL because `buildStaticCacheManifest` does not exist.

- [ ] **Step 3: Implement helper**

Add:

```js
export function buildStaticCacheManifest() {
  return [
    './',
    './index.html',
    './app.js',
    './sounds.js',
    './sanctuaries.js',
    './live-sources.js',
    './audio-artifacts.js',
    './catalog-overrides.json',
  ];
}
```

- [ ] **Step 4: Create service worker**

Create `sw.js`:

```js
const CACHE_NAME = 'ocean-jukebox-v3';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './sounds.js',
  './sanctuaries.js',
  './live-sources.js',
  './audio-artifacts.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    })),
  );
});
```

- [ ] **Step 5: Register service worker**

In `index.html`, add:

```html
<link rel="manifest" href="./site.webmanifest" />
```

Before closing `body`, add:

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
</script>
```

- [ ] **Step 6: Create manifest**

Create `site.webmanifest`:

```json
{
  "name": "Ocean Jukebox",
  "short_name": "Ocean Jukebox",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#141712",
  "theme_color": "#315f4b"
}
```

- [ ] **Step 7: Browser verify**

Open local app over HTTP. In browser automation, check:

```js
await page.evaluate(() => navigator.serviceWorker.getRegistration().then(Boolean))
```

Expected: `true` after page load. Then reload with network disabled if supported; app shell still loads.

- [ ] **Step 8: Commit**

```bash
git add sw.js site.webmanifest index.html app-core.mjs tests/app-core.test.mjs README.md
git commit -m "feat: add offline app shell"
```

---

### Task 9: Mobile Polish and Final QA

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `README.md`
- Modify tests only if logic defects are found

- [ ] **Step 1: Run automated checks**

Run:

```bash
node --test tests/app-core.test.mjs tests/catalog.test.mjs
node --check app.js
node --check app-core.mjs
node --check scripts/catalog.mjs
node --check scripts/generate-spectrograms.mjs
node --check scripts/validate-catalog.mjs
node --check scripts/check-live-sources.mjs
node --check scripts/analyze-audio.mjs
```

Expected: all commands exit 0.

- [ ] **Step 2: Run generated data checks**

Run:

```bash
node scripts/validate-catalog.mjs
```

Expected: exits 0 and writes `catalog-report.md`.

- [ ] **Step 3: Browser QA desktop**

Start local server:

```bash
python3 -m http.server 8000
```

Check these URLs:

```text
http://localhost:8000/
http://localhost:8000/?tab=map&category=whale&year=2020
http://localhost:8000/?tab=live
http://localhost:8000/?tab=spectrogram&track=SanctSound_GR03_02_hurricane_20190904T221437Z
```

Expected:
- no console errors
- Leaflet map tiles/markers render
- map filter controls work
- detail drawer content fits
- live tab shows checked status
- spectrogram tab shows image or clean empty state

- [ ] **Step 4: Browser QA mobile**

Set viewport to `390x844` and verify:

- hero/first screen does not hide primary controls
- tabs wrap or scroll without overlap
- map panel becomes one column
- Leaflet map height is usable
- detail panel fields are one column
- waveform canvas does not overflow
- track rows truncate without overlapping metadata

- [ ] **Step 5: Fix CSS defects directly**

If browser QA finds visual-only issues, edit `index.html` CSS. Example fix for tabs overflow:

```css
.tabs {
  overflow-x: auto;
  scrollbar-width: thin;
}

.tab {
  white-space: nowrap;
}
```

Then rerun desktop and mobile browser QA.

- [ ] **Step 6: Update README final feature list**

Add bullets:

```markdown
- **Leaflet map** with sanctuary markers, category filters, and year filters
- **Generated audio artifacts** for spectrograms, waveform previews, and acoustic profiles
- **Catalog validation report** generated by `node scripts/validate-catalog.mjs`
- **Live-source status checks** generated by `node scripts/check-live-sources.mjs`
- **Offline app shell** through `sw.js`
```

- [ ] **Step 7: Commit**

```bash
git add index.html app.js README.md catalog-report.md
git commit -m "polish: verify phase three technical showcase"
```

---

## Self-Review

- Spec coverage: Leaflet map and year/category marker filtering are covered in Task 2; better first screen and track detail page in Task 3; map interaction in Task 2; live tab reality/status checker in Task 5; audio loading feedback in Task 7; mobile polish in Task 9; generated spectrograms/waveforms/acoustic profile in Task 6 and Task 7; catalog validation/report pipeline in Task 4; service worker offline shell in Task 8; back/forward URL-state restoration in Task 1.
- Placeholder scan: no unresolved placeholder markers or vague “handle later” instructions remain. Optional tooling is explicitly allowed to be absent, with expected behavior specified.
- Type consistency: route state uses `tab`, `category`, `sanctuary`, `query`, `sort`, `year`, and `track`; live source status uses `status`, `statusCode`, `statusLabel`, and `checkedAt`; audio artifacts use `tracks[trackId]`, `spectrogramPath`, `waveformPeaks`, and `profile`.
