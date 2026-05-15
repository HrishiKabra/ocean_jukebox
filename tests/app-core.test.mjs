import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCatalogState,
  formatDate,
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
