import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRouteState,
  buildAcousticProfile,
  buildAudioArtifact,
  buildLiveSourceCards,
  buildFilteredMapPins,
  buildMapPins,
  buildMapPinSummary,
  buildPreviewWaveform,
  buildSpectrogramPath,
  buildStaticCacheManifest,
  buildWaveformPath,
  buildYearOptions,
  buildVariantGroups,
  buildTrackDetail,
  createCatalogState,
  formatDate,
  getVisibleIndexes,
  normalizeLiveSourceStatus,
  normalizeRoute,
  normalizeWaveformPeaks,
  parseRoute,
  projectMapPosition,
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

test('getVisibleIndexes filters by category sanctuary query and explicit order', () => {
  const orderedTracks = [
    { filename: 'a.mp4', label: 'Humpback call', sanctuary: 'Hawaiian Islands', category: 'whale' },
    { filename: 'b.mp4', label: 'Humpback song', sanctuary: 'Hawaiian Islands', category: 'whale' },
    { filename: 'c.mp4', label: 'Humpback rain', sanctuary: 'Hawaiian Islands', category: 'weather' },
  ];

  assert.deepEqual(
    getVisibleIndexes(orderedTracks, {
      category: 'whale',
      sanctuary: 'Hawaiian Islands',
      query: 'hump',
      sort: 'curated',
      order: [1, 0, 2],
    }),
    [1, 0],
  );
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

test('builds static spectrogram path from track id', () => {
  assert.equal(
    buildSpectrogramPath({ filename: 'SanctSound_GR03_02_hurricane_20190904T221437Z.mp4' }),
    'spectrograms/SanctSound_GR03_02_hurricane_20190904T221437Z.png',
  );
});

test('builds static waveform path from track id', () => {
  assert.equal(
    buildWaveformPath({ filename: 'SanctSound_GR03_02_hurricane_20190904T221437Z.mp4' }),
    'waveforms/SanctSound_GR03_02_hurricane_20190904T221437Z.png',
  );
});

test('normalizes waveform peaks into fixed display buckets', () => {
  assert.deepEqual(normalizeWaveformPeaks([0, 0.25, 0.75, 2], 2), [0.25, 1]);
  assert.deepEqual(normalizeWaveformPeaks([], 3), [0, 0, 0]);
});

test('builds deterministic preview waveform peaks', () => {
  const first = buildPreviewWaveform({ filename: 'a.mp4' }, 8);
  const second = buildPreviewWaveform({ filename: 'a.mp4' }, 8);

  assert.equal(first.length, 8);
  assert.deepEqual(first, second);
  assert.ok(first.every(value => value >= 0 && value <= 1));
});

test('builds acoustic profile metadata from catalog and probe data', () => {
  assert.deepEqual(
    buildAcousticProfile(
      {
        filename: 'a.mp4',
        category: 'whale',
        sanctuary: 'Monterey Bay',
        site: 'MB01',
        deployment: '02',
        variant: 'enhanced',
        recordedAt: '2020-05-01T00:00:00Z',
      },
      { durationSeconds: 12.345, sampleRate: 48000, channels: 2 },
    ),
    {
      recordedYear: '2020',
      category: 'whale',
      sanctuary: 'Monterey Bay',
      site: 'MB01',
      deployment: '02',
      variant: 'enhanced',
      durationSeconds: 12.35,
      sampleRate: 48000,
      channels: 2,
    },
  );
});

test('builds complete audio artifact records', () => {
  const artifact = buildAudioArtifact(
    {
      filename: 'SanctSound_MB01_02_bluewhale_20200501T000000Z.mp4',
      category: 'whale',
      sanctuary: 'Monterey Bay',
      recordedAt: '2020-05-01T00:00:00Z',
    },
    { generatedAt: '2026-05-15T00:00:00.000Z', peaks: [0, 0.5, 1] },
  );

  assert.equal(artifact.id, 'SanctSound_MB01_02_bluewhale_20200501T000000Z');
  assert.equal(artifact.analysisStatus, 'analyzed');
  assert.equal(artifact.waveformPeaks.length, 64);
  assert.equal(artifact.acousticProfile.recordedYear, '2020');
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

test('groups original and enhanced variants by groupKey', () => {
  const groups = buildVariantGroups([
    { filename: 'a.mp4', groupKey: 'CI05-04-finwhale', variant: 'original' },
    { filename: 'a_6xSpeed.wav', groupKey: 'CI05-04-finwhale', variant: 'enhanced' },
    { filename: 'b.mp4', groupKey: 'GR01-01-snapshots', variant: 'original' },
  ]);

  assert.equal(groups.get('CI05-04-finwhale').original.filename, 'a.mp4');
  assert.equal(groups.get('CI05-04-finwhale').enhanced.length, 1);
  assert.equal(groups.get('GR01-01-snapshots').enhanced.length, 0);
});

test('buildVariantGroups treats duplicate originals as enhanced alternatives', () => {
  const groups = buildVariantGroups([
    { filename: 'a.mp4', groupKey: 'g', variant: 'original' },
    { filename: 'b.mp4', groupKey: 'g', variant: 'original' },
  ]);

  assert.equal(groups.get('g').original.filename, 'a.mp4');
  assert.deepEqual(groups.get('g').enhanced.map(track => track.filename), ['b.mp4']);
});

test('builds map pins with recording counts and active sanctuary state', () => {
  const pins = buildMapPins(
    [
      { name: 'Monterey Bay', coordinates: [36.8, -121.9], region: 'West Coast', note: 'Canyon edge habitat.' },
      { name: 'Florida Keys', coordinates: [24.6, -81.7], region: 'Southeast', note: 'Reef soundscape.' },
    ],
    [
      { sanctuary: 'Monterey Bay' },
      { sanctuary: 'Monterey Bay' },
      { sanctuary: 'Florida Keys' },
    ],
    'Florida Keys',
  );

  assert.deepEqual(
    pins.map(pin => ({
      name: pin.name,
      count: pin.count,
      active: pin.active,
    })),
    [
      { name: 'Monterey Bay', count: 2, active: false },
      { name: 'Florida Keys', count: 1, active: true },
    ],
  );
});

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
      { recordedAt: 'invalid-date' },
    ]),
    ['all', '2020', '2019'],
  );
});

test('builds useful map marker summary text for filtered pins', () => {
  assert.equal(
    buildMapPinSummary({
      name: 'Monterey Bay',
      displayName: 'Monterey Bay National Marine Sanctuary',
      region: 'West Coast',
      note: 'Deep submarine canyon habitat.',
      count: 3,
    }),
    'Monterey Bay National Marine Sanctuary: 3 recordings in West Coast. Deep submarine canyon habitat.',
  );
});

test('builds live source cards with playable stream or source check action', () => {
  assert.deepEqual(
    buildLiveSourceCards([
      {
        id: 'a',
        name: 'A',
        status: 'online',
        pageUrl: 'https://example.com/a',
        streamUrl: 'https://example.com/a.m3u8',
      },
      {
        id: 'b',
        name: 'B',
        status: 'check-source',
        pageUrl: 'https://example.com/b',
        streamUrl: '',
      },
    ]),
    [
      {
        id: 'a',
        name: 'A',
        status: 'online',
        playable: true,
        actionLabel: 'Open stream',
        url: 'https://example.com/a.m3u8',
      },
      {
        id: 'b',
        name: 'B',
        status: 'check-source',
        playable: false,
        actionLabel: 'Check source',
        url: 'https://example.com/b',
      },
    ],
  );
});

test('normalizes live source status without overstating page-only sources', () => {
  assert.deepEqual(
    normalizeLiveSourceStatus({
      ok: true,
      kind: 'stream',
      statusCode: 200,
      checkedAt: '2026-05-15T00:00:00Z',
    }),
    {
      status: 'online',
      statusCode: 200,
      statusLabel: 'Stream reachable',
      statusDetail: 'Direct stream URL responded to the status check.',
      checkedAt: '2026-05-15T00:00:00Z',
    },
  );

  assert.deepEqual(
    normalizeLiveSourceStatus({
      ok: true,
      kind: 'page',
      statusCode: 200,
      checkedAt: '2026-05-15T00:00:00Z',
    }),
    {
      status: 'source-page',
      statusCode: 200,
      statusLabel: 'Source page reachable',
      statusDetail: 'Source page responded, but no direct live stream URL is configured.',
      checkedAt: '2026-05-15T00:00:00Z',
    },
  );

  assert.deepEqual(
    normalizeLiveSourceStatus({
      ok: false,
      kind: 'page',
      statusCode: 503,
      checkedAt: '2026-05-15T00:00:00Z',
    }),
    {
      status: 'offline',
      statusCode: 503,
      statusLabel: 'Unavailable',
      statusDetail: 'Source did not respond successfully to the status check.',
      checkedAt: '2026-05-15T00:00:00Z',
    },
  );
});

test('builds service worker cache manifest with required static files', () => {
  assert.deepEqual(buildStaticCacheManifest(), [
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
  ]);
});

test('projects map coordinates into a padded visible range', () => {
  assert.deepEqual(
    projectMapPosition(
      { lat: 48, lng: -172 },
      { minLat: 20, maxLat: 48, minLng: -172, maxLng: -70 },
    ),
    { x: 18, y: 18 },
  );

  assert.deepEqual(
    projectMapPosition(
      { lat: 20, lng: -70 },
      { minLat: 20, maxLat: 48, minLng: -172, maxLng: -70 },
    ),
    { x: 82, y: 82 },
  );
});

test('separates crowded map pins after projection clamping', () => {
  const pins = buildMapPins(
    [
      { name: 'Hawaiian Islands', coordinates: [20.7, -156.5], region: 'Pacific Islands', note: '' },
      { name: 'Papahānaumokuākea', coordinates: [25.7, -171.7], region: 'Pacific Islands', note: '' },
    ],
    [],
  );

  assert.equal(
    pins.some((pin, index) => {
      const other = pins[index + 1];
      return other && Math.abs(pin.x - other.x) < 12 && Math.abs(pin.y - other.y) < 12;
    }),
    false,
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
      year: 'all',
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
      year: 'all',
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
      parseRoute('?category=bogus&sanctuary=bogus&sort=bogus&tab=bogus&q=dorian&year=1776'),
      {
        categories: ['all', 'weather'],
        sanctuaries: ['all', "Gray's Reef"],
        tabs: ['archive', 'map'],
        years: ['all', '2019'],
      },
    ),
    {
      track: '',
      category: 'all',
      sanctuary: 'all',
      query: 'dorian',
      sort: 'curated',
      tab: 'archive',
      year: 'all',
    },
  );
});

test('normalizes route while preserving valid catalog values', () => {
  assert.deepEqual(
    normalizeRoute(
      parseRoute('?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather&sanctuary=Gray%27s%20Reef&q=dorian&sort=newest&tab=map&year=2019'),
      {
        categories: ['all', 'weather'],
        sanctuaries: ['all', "Gray's Reef"],
        tabs: ['archive', 'map'],
        years: ['all', '2019'],
      },
    ),
    {
      track: 'SanctSound_GR03_02_hurricane_20190904T221437Z',
      category: 'weather',
      sanctuary: "Gray's Reef",
      query: 'dorian',
      sort: 'newest',
      tab: 'map',
      year: '2019',
    },
  );
});

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

test('route helpers normalize invalid values before app state uses them', () => {
  const normalized = normalizeRoute(
    parseRoute('?category=bogus&sanctuary=bogus&tab=bogus&year=1776'),
    {
      categories: ['all', 'weather'],
      sanctuaries: ['all', "Gray's Reef"],
      tabs: ['archive', 'map'],
      years: ['all', '2019'],
    },
  );

  assert.deepEqual(
    getVisibleIndexes(tracks, {
      category: 'whale',
      sanctuary: 'Hawaiian Islands',
      query: 'hump',
      sort: 'curated',
      tab: 'archive',
      year: 'all',
    },
  );

  const validRoute = normalizeRoute(
    parseRoute('?category=weather&sanctuary=Gray%27s%20Reef&q=dorian&sort=newest&tab=map&year=2019'),
    {
      categories: ['all', 'weather'],
      sanctuaries: ['all', "Gray's Reef"],
      tabs: ['archive', 'map'],
      years: ['all', '2019'],
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
      year: '2019',
    },
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
