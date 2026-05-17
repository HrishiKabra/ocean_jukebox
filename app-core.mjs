export const CATEGORY_LABELS = {
  all: 'All',
  whale: 'Whales',
  dolphin: 'Dolphins',
  fish: 'Fish',
  invertebrate: 'Invertebrates',
  'marine mammal': 'Marine mammals',
  weather: 'Weather',
  vessel: 'Vessels',
  human: 'Human',
  soundscape: 'Soundscapes',
};

export const SORT_LABELS = {
  curated: 'Catalog order',
  newest: 'Newest',
  oldest: 'Oldest',
  sanctuary: 'Sanctuary',
};

export const DEFAULT_ROUTE = {
  track: '',
  category: 'all',
  sanctuary: 'all',
  query: '',
  sort: 'curated',
  tab: 'archive',
  year: 'all',
};

export function trackId(track) {
  return (track.filename || '').replace(/\.[^.]*$/, '');
}

export function buildSpectrogramPath(track) {
  return `spectrograms/${trackId(track)}.png`;
}

export function buildWaveformPath(track) {
  return `waveforms/${trackId(track)}.png`;
}

export function parseRoute(search = '') {
  const params = new URLSearchParams(search);
  return {
    track: params.get('track') || DEFAULT_ROUTE.track,
    category: params.get('category') || DEFAULT_ROUTE.category,
    sanctuary: params.get('sanctuary') || DEFAULT_ROUTE.sanctuary,
    query: params.get('q') || DEFAULT_ROUTE.query,
    sort: params.get('sort') || DEFAULT_ROUTE.sort,
    tab: params.get('tab') || DEFAULT_ROUTE.tab,
    year: params.get('year') || DEFAULT_ROUTE.year,
  };
}

function allowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeRoute(route, { categories = ['all'], sanctuaries = ['all'], tabs = ['archive'], years = ['all'] } = {}) {
  const sorts = Object.keys(SORT_LABELS);
  return {
    track: route.track || DEFAULT_ROUTE.track,
    category: allowedValue(route.category, categories, DEFAULT_ROUTE.category),
    sanctuary: allowedValue(route.sanctuary, sanctuaries, DEFAULT_ROUTE.sanctuary),
    query: route.query || DEFAULT_ROUTE.query,
    sort: allowedValue(route.sort, sorts, DEFAULT_ROUTE.sort),
    tab: allowedValue(route.tab, tabs, DEFAULT_ROUTE.tab),
    year: allowedValue(route.year, years, DEFAULT_ROUTE.year),
  };
}

export function serializeRoute(route) {
  const params = new URLSearchParams();
  if (route.track) params.set('track', route.track);
  if (route.category && route.category !== DEFAULT_ROUTE.category) params.set('category', route.category);
  if (route.tab && route.tab !== DEFAULT_ROUTE.tab) params.set('tab', route.tab);
  if (route.sanctuary && route.sanctuary !== DEFAULT_ROUTE.sanctuary) params.set('sanctuary', route.sanctuary);
  if (route.query) params.set('q', route.query);
  if (route.sort && route.sort !== DEFAULT_ROUTE.sort) params.set('sort', route.sort);
  if (route.year && route.year !== DEFAULT_ROUTE.year) params.set('year', route.year);
  const query = params.toString();
  return query ? `?${query}` : '';
}

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

function searchable(track) {
  return [
    track.label,
    track.description,
    track.sanctuary,
    track.category,
    track.site,
    track.filename,
  ].join(' ').toLowerCase();
}

function recordedTime(track) {
  return track.recordedAt ? Date.parse(track.recordedAt) : 0;
}

function sortIndexes(indexes, tracks, sort) {
  const sorted = [...indexes];
  if (sort === 'newest') {
    sorted.sort((a, b) => recordedTime(tracks[b]) - recordedTime(tracks[a]));
  } else if (sort === 'oldest') {
    sorted.sort((a, b) => recordedTime(tracks[a]) - recordedTime(tracks[b]));
  } else if (sort === 'sanctuary') {
    sorted.sort((a, b) => {
      const sanc = tracks[a].sanctuary.localeCompare(tracks[b].sanctuary);
      return sanc || tracks[a].label.localeCompare(tracks[b].label);
    });
  }
  return sorted;
}

export function getVisibleIndexes(tracks, { category = 'all', sanctuary = 'all', query = '', sort = 'curated', order = null } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const baseOrder = order ?? tracks.map((_, index) => index);
  const filtered = baseOrder.filter(index => {
    const track = tracks[index];
    const matchesCategory = category === 'all' || track.category === category;
    const matchesSanctuary = sanctuary === 'all' || track.sanctuary === sanctuary;
    const matchesQuery = !normalizedQuery || searchable(track).includes(normalizedQuery);
    return matchesCategory && matchesSanctuary && matchesQuery;
  });
  return sortIndexes(filtered, tracks, sort);
}

export function createCatalogState(tracks) {
  const state = {
    tracks,
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    order: tracks.map((_, index) => index),
    currentIndex: 0,
    visibleIndexes: tracks.map((_, index) => index),
    setCurrent(index) {
      if (Number.isInteger(index) && index >= 0 && index < tracks.length) {
        this.currentIndex = index;
      }
    },
    setCategory(category) {
      this.category = category;
      this.recomputeVisible();
    },
    setSanctuary(sanctuary) {
      this.sanctuary = sanctuary;
      this.recomputeVisible();
    },
    setQuery(query) {
      this.query = query;
      this.recomputeVisible();
    },
    setSort(sort) {
      this.sort = sort;
      this.recomputeVisible();
    },
    setOrder(order) {
      this.order = order;
      this.recomputeVisible();
    },
    recomputeVisible() {
      this.visibleIndexes = getVisibleIndexes(tracks, this);
      if (this.visibleIndexes.length && !this.visibleIndexes.includes(this.currentIndex)) {
        this.currentIndex = this.visibleIndexes[0];
      }
    },
  };
  state.recomputeVisible();
  return state;
}

export function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function buildTrackDetail(track) {
  return {
    id: trackId(track),
    title: track.label,
    sanctuary: track.sanctuary,
    category: track.category,
    description: track.description || 'No description available from the source catalog.',
    recorded: formatDate(track.recordedAt),
    site: track.site || 'Unknown site',
    deployment: track.deployment || 'Unknown deployment',
    filename: track.filename,
    sourceUrl: track.url,
  };
}

function seededPeakValue(seed, index) {
  const value = Math.sin((seed + index * 17.17) * 12.9898) * 43758.5453;
  return Math.abs(value - Math.floor(value));
}

export function normalizeWaveformPeaks(peaks = [], targetLength = 64) {
  const values = peaks
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
    .map(value => Math.max(0, Math.min(1, value)));

  if (!values.length) return Array.from({ length: targetLength }, () => 0);
  if (values.length === targetLength) return values;

  return Array.from({ length: targetLength }, (_, index) => {
    const start = Math.floor((index / targetLength) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / targetLength) * values.length));
    const bucket = values.slice(start, end);
    return Math.max(...bucket);
  });
}

export function buildPreviewWaveform(track, targetLength = 64) {
  const id = trackId(track);
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: targetLength }, (_, index) => {
    const envelope = Math.sin((index / Math.max(1, targetLength - 1)) * Math.PI);
    const texture = 0.35 + seededPeakValue(seed, index) * 0.65;
    return Number(Math.max(0.08, envelope * texture).toFixed(3));
  });
}

export function buildAcousticProfile(track, probe = {}) {
  const durationSeconds = Number.isFinite(probe.durationSeconds) ? Number(probe.durationSeconds.toFixed(2)) : null;
  const sampleRate = Number.isFinite(probe.sampleRate) ? probe.sampleRate : null;
  const channels = Number.isFinite(probe.channels) ? probe.channels : null;
  return {
    recordedYear: recordingYear(track) || null,
    category: track.category || 'unknown',
    sanctuary: track.sanctuary || 'Unknown sanctuary',
    site: track.site || 'Unknown site',
    deployment: track.deployment || 'Unknown deployment',
    variant: track.variant || 'original',
    durationSeconds,
    sampleRate,
    channels,
  };
}

export function buildAudioArtifact(track, { probe = {}, peaks = [], generatedAt = '' } = {}) {
  const normalizedPeaks = peaks.length ? normalizeWaveformPeaks(peaks) : buildPreviewWaveform(track);
  return {
    id: trackId(track),
    filename: track.filename,
    spectrogramPath: buildSpectrogramPath(track),
    waveformPath: buildWaveformPath(track),
    waveformPeaks: normalizedPeaks,
    acousticProfile: buildAcousticProfile(track, probe),
    analysisStatus: peaks.length ? 'analyzed' : 'preview',
    generatedAt,
  };
}

export function buildLiveSourceCards(sources = []) {
  return sources.map(source => {
    const playable = source.status === 'online' && Boolean(source.streamUrl);
    return {
      id: source.id,
      name: source.name,
      status: source.status,
      ...(source.statusLabel ? { statusLabel: source.statusLabel } : {}),
      ...(source.statusCode !== undefined ? { statusCode: source.statusCode } : {}),
      ...(source.statusDetail ? { statusDetail: source.statusDetail } : {}),
      ...(source.checkedAt ? { checkedAt: source.checkedAt } : {}),
      playable,
      actionLabel: playable ? 'Open stream' : 'Check source',
      url: playable ? source.streamUrl : source.pageUrl,
    };
  });
}

export function normalizeLiveSourceStatus(result) {
  const checkedAt = result.checkedAt;
  const statusCode = Number.isInteger(result.statusCode) ? result.statusCode : 0;
  if (result.ok && result.kind === 'stream') {
    return {
      status: 'online',
      statusCode,
      statusLabel: 'Stream reachable',
      statusDetail: 'Direct stream URL responded to the status check.',
      checkedAt,
    };
  }
  if (result.ok) {
    return {
      status: 'source-page',
      statusCode,
      statusLabel: 'Source page reachable',
      statusDetail: 'Source page responded, but no direct live stream URL is configured.',
      checkedAt,
    };
  }
  return {
    status: 'offline',
    statusCode,
    statusLabel: 'Unavailable',
    statusDetail: result.error ? `Status check failed: ${result.error}` : 'Source did not respond successfully to the status check.',
    checkedAt,
  };
}

export function buildStaticCacheManifest() {
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
}

export function buildVariantGroups(tracks) {
  const groups = new Map();
  tracks.forEach(track => {
    const key = track.groupKey || trackId(track);
    if (!groups.has(key)) groups.set(key, { original: null, enhanced: [] });
    const group = groups.get(key);
    if (track.variant === 'enhanced') {
      group.enhanced.push(track);
    } else if (!group.original) {
      group.original = track;
    } else {
      group.enhanced.push(track);
    }
  });
  return groups;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function projectMapPosition(point, bounds, inset = 18) {
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const rawX = ((point.lng - bounds.minLng) / lngRange) * 100;
  const rawY = ((bounds.maxLat - point.lat) / latRange) * 100;
  return {
    x: clamp(rawX, inset, 100 - inset),
    y: clamp(rawY, inset, 100 - inset),
  };
}

function conflictsWithPlacedPins(pin, placedPins, minGap) {
  return placedPins.some(placed => (
    Math.abs(pin.x - placed.x) < minGap
    && Math.abs(pin.y - placed.y) < minGap
  ));
}

function separateMapPins(pins, minGap = 12) {
  const placedPins = [];
  return pins.map(pin => {
    const positioned = { ...pin };
    const offsets = [0, minGap, -minGap, minGap * 2, -minGap * 2, minGap * 3, -minGap * 3];

    for (const offset of offsets) {
      const candidateX = clamp(pin.x + offset, 18, 82);
      positioned.x = candidateX;
      if (!conflictsWithPlacedPins(positioned, placedPins, minGap)) break;
    }

    placedPins.push(positioned);
    return positioned;
  });
}

function sanctuaryCoordinates(sanctuary) {
  if (Array.isArray(sanctuary.coordinates)) return sanctuary.coordinates;
  return [sanctuary.lat || 0, sanctuary.lon ?? sanctuary.lng ?? 0];
}

export function buildMapPins(sanctuaries, tracks, activeSanctuary = 'all') {
  const counts = new Map();
  tracks.forEach(track => {
    if (!track.sanctuary) return;
    counts.set(track.sanctuary, (counts.get(track.sanctuary) || 0) + 1);
  });

  const bounds = sanctuaries.reduce((acc, sanctuary) => {
    const [lat, lng] = sanctuaryCoordinates(sanctuary);
    return {
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng),
    };
  }, {
    minLat: 20,
    maxLat: 48,
    minLng: -172,
    maxLng: -70,
  });

  const pins = sanctuaries.map(sanctuary => {
    const [lat, lng] = sanctuaryCoordinates(sanctuary);
    const position = projectMapPosition({ lat, lng }, bounds);
    return {
      ...sanctuary,
      lat,
      lng,
      count: counts.get(sanctuary.name) || 0,
      active: activeSanctuary !== 'all' && sanctuary.name === activeSanctuary,
      x: position.x,
      y: position.y,
    };
  });

  return separateMapPins(pins);
}

export function recordingYear(track) {
  if (!track.recordedAt) return '';
  const year = new Date(track.recordedAt).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : '';
}

export function buildYearOptions(tracks) {
  const years = [...new Set(tracks.map(recordingYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  return ['all', ...years];
}

export function buildFilteredMapPins(
  sanctuaries,
  tracks,
  { category = 'all', year = 'all', activeSanctuary = 'all' } = {},
) {
  const filtered = tracks.filter(track => (
    (category === 'all' || track.category === category)
    && (year === 'all' || recordingYear(track) === year)
  ));
  return buildMapPins(sanctuaries, filtered, activeSanctuary);
}

export function formatCount(count) {
  return `${count} ${count === 1 ? 'recording' : 'recordings'}`;
}

export function buildMapPinSummary(pin) {
  if (!pin) return 'No sanctuary map metadata available.';
  const displayName = pin.displayName || pin.name;
  const region = pin.region ? ` in ${pin.region}` : '';
  const note = pin.note ? ` ${pin.note}` : '';
  return `${displayName}: ${formatCount(pin.count)}${region}.${note}`;
}
