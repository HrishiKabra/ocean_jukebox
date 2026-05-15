import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCatalogState,
  formatDate,
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
