import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  buildTrackDetail,
  createCatalogState,
  formatDate,
  normalizeRoute,
  parseRoute,
  serializeRoute,
  trackId,
} from '../app-core.mjs';

const tracks = [
  { filename: 'a.mp4', label: 'Humpback', sanctuary: 'Hawaiian Islands', category: 'whale', recordedAt: '2020-01-02T03:04:05Z' },
  { filename: 'b.mp4', label: 'Rain', sanctuary: 'Florida Keys', category: 'weather', recordedAt: '2019-01-02T03:04:05Z' },
  { filename: 'c.mp4', label: 'Cod', sanctuary: 'Stellwagen Bank', category: 'fish', recordedAt: '2021-01-02T03:04:05Z' },
];

test('moves current track to the first visible result after category filter excludes it', () => {
  const state = createCatalogState(tracks);

  state.setCurrent(0);
  state.setCategory('weather');

  assert.equal(state.currentIndex, 1);
  assert.deepEqual(state.visibleIndexes, [1]);
});

test('search matches label and sanctuary, then falls back to first result', () => {
  const state = createCatalogState(tracks);

  state.setCurrent(2);
  state.setQuery('hawaiian');

  assert.equal(state.currentIndex, 0);
  assert.deepEqual(state.visibleIndexes, [0]);
});

test('sorts newest and oldest without losing selected visible track', () => {
  const state = createCatalogState(tracks);

  state.setCurrent(1);
  state.setSort('newest');

  assert.equal(state.currentIndex, 1);
  assert.deepEqual(state.visibleIndexes, [2, 0, 1]);

  state.setSort('oldest');

  assert.equal(state.currentIndex, 1);
  assert.deepEqual(state.visibleIndexes, [1, 0, 2]);
});

test('formats missing and valid dates for compact metadata', () => {
  assert.equal(formatDate(null), 'Unknown date');
  assert.equal(formatDate('2020-01-02T03:04:05Z'), 'Jan 2, 2020');
});

test('creates stable URL track ids from filenames', () => {
  assert.equal(
    trackId({ filename: 'SanctSound_GR03_02_hurricane_20190904T221437Z.mp4' }),
    'SanctSound_GR03_02_hurricane_20190904T221437Z',
  );
});

test('builds track detail with source URL and fallback metadata', () => {
  assert.deepEqual(
    buildTrackDetail({
      filename: 'haddock.mp4',
      url: 'https://sanctsound.ioos.us/files/haddock.mp4',
      label: 'Haddock knocks',
      sanctuary: 'Stellwagen Bank',
      category: 'fish',
      description: '',
      recordedAt: null,
      site: null,
      deployment: null,
    }),
    {
      id: 'haddock',
      title: 'Haddock knocks',
      sanctuary: 'Stellwagen Bank',
      category: 'fish',
      description: 'No description available from the source catalog.',
      recorded: 'Unknown date',
      site: 'Unknown site',
      deployment: 'Unknown deployment',
      filename: 'haddock.mp4',
      sourceUrl: 'https://sanctsound.ioos.us/files/haddock.mp4',
    },
  );
});

test('parses shareable route state from query params', () => {
  assert.deepEqual(
    parseRoute('?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather&sanctuary=Gray%27s%20Reef&q=dorian&sort=newest'),
    {
      track: 'SanctSound_GR03_02_hurricane_20190904T221437Z',
      category: 'weather',
      sanctuary: "Gray's Reef",
      query: 'dorian',
      sort: 'newest',
      tab: 'archive',
    },
  );
});

test('serializes shareable route state while omitting defaults', () => {
  assert.equal(
    serializeRoute({
      track: 'SanctSound_GR03_02_hurricane_20190904T221437Z',
      category: 'weather',
      sanctuary: 'all',
      query: '',
      sort: 'curated',
      tab: 'archive',
    }),
    '?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather',
  );
});

test('serializes non-empty route query with q parameter', () => {
  assert.equal(
    serializeRoute({
      track: '',
      category: 'all',
      sanctuary: 'all',
      query: 'dorian',
      sort: 'curated',
      tab: 'archive',
    }),
    '?q=dorian',
  );
});

test('normalizes invalid route values to defaults', () => {
  assert.deepEqual(
    normalizeRoute(
      parseRoute('?category=bogus&sanctuary=bogus&sort=bogus&tab=bogus&q=dorian'),
      {
        categories: ['all', 'weather'],
        sanctuaries: ['all', "Gray's Reef"],
        tabs: ['archive', 'map'],
      },
    ),
    {
      track: '',
      category: 'all',
      sanctuary: 'all',
      query: 'dorian',
      sort: 'curated',
      tab: 'archive',
    },
  );
});

test('normalizes route while preserving valid catalog values', () => {
  assert.deepEqual(
    normalizeRoute(
      parseRoute('?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather&sanctuary=Gray%27s%20Reef&q=dorian&sort=newest&tab=map'),
      {
        categories: ['all', 'weather'],
        sanctuaries: ['all', "Gray's Reef"],
        tabs: ['archive', 'map'],
      },
    ),
    {
      track: 'SanctSound_GR03_02_hurricane_20190904T221437Z',
      category: 'weather',
      sanctuary: "Gray's Reef",
      query: 'dorian',
      sort: 'newest',
      tab: 'map',
    },
  );
});

test('browser route helper normalizes invalid values before app state uses them', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const sandbox = {
    URLSearchParams,
    window: { OCEAN_JUKEBOX_CATALOG: { tracks: [] } },
    document: {
      addEventListener() {},
      querySelectorAll() {
        return [];
      },
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  vm.runInNewContext(source, sandbox);

  const normalized = sandbox.window.OCEAN_JUKEBOX_ROUTE_HELPERS.normalizeRoute(
    sandbox.window.OCEAN_JUKEBOX_ROUTE_HELPERS.parseRoute('?category=bogus&sanctuary=bogus&tab=bogus'),
    {
      categories: ['all', 'weather'],
      sanctuaries: ['all', "Gray's Reef"],
      tabs: ['archive', 'map'],
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(normalized)),
    {
      track: '',
      category: 'all',
      sanctuary: 'all',
      query: '',
      sort: 'curated',
      tab: 'archive',
    },
  );

  const validRoute = sandbox.window.OCEAN_JUKEBOX_ROUTE_HELPERS.normalizeRoute(
    sandbox.window.OCEAN_JUKEBOX_ROUTE_HELPERS.parseRoute('?category=weather&sanctuary=Gray%27s%20Reef&q=dorian&sort=newest&tab=map'),
    {
      categories: ['all', 'weather'],
      sanctuaries: ['all', "Gray's Reef"],
      tabs: ['archive', 'map'],
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(validRoute)),
    {
      track: '',
      category: 'weather',
      sanctuary: "Gray's Reef",
      query: 'dorian',
      sort: 'newest',
      tab: 'map',
    },
  );
});
