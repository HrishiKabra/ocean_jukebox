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

export function formatCount(count) {
  return `${count} ${count === 1 ? 'recording' : 'recordings'}`;
}
