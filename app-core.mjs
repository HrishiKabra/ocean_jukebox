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
};

export function trackId(track) {
  return (track.filename || '').replace(/\.[^.]*$/, '');
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
  };
}

function allowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeRoute(route, { categories = ['all'], sanctuaries = ['all'], tabs = ['archive'] } = {}) {
  const sorts = Object.keys(SORT_LABELS);
  return {
    track: route.track || DEFAULT_ROUTE.track,
    category: allowedValue(route.category, categories, DEFAULT_ROUTE.category),
    sanctuary: allowedValue(route.sanctuary, sanctuaries, DEFAULT_ROUTE.sanctuary),
    query: route.query || DEFAULT_ROUTE.query,
    sort: allowedValue(route.sort, sorts, DEFAULT_ROUTE.sort),
    tab: allowedValue(route.tab, tabs, DEFAULT_ROUTE.tab),
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
  const query = params.toString();
  return query ? `?${query}` : '';
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

export function buildMapPins(sanctuaries, tracks, activeSanctuary = 'all') {
  const counts = new Map();
  tracks.forEach(track => {
    if (!track.sanctuary) return;
    counts.set(track.sanctuary, (counts.get(track.sanctuary) || 0) + 1);
  });

  const bounds = sanctuaries.reduce((acc, sanctuary) => {
    const [lat, lng] = sanctuary.coordinates || [0, 0];
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

  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;

  return sanctuaries.map(sanctuary => {
    const [lat, lng] = sanctuary.coordinates || [0, 0];
    return {
      ...sanctuary,
      lat,
      lng,
      count: counts.get(sanctuary.name) || 0,
      active: activeSanctuary !== 'all' && sanctuary.name === activeSanctuary,
      x: ((lng - bounds.minLng) / lngRange) * 100,
      y: ((bounds.maxLat - lat) / latRange) * 100,
    };
  });
}

export function formatCount(count) {
  return `${count} ${count === 1 ? 'recording' : 'recordings'}`;
}
