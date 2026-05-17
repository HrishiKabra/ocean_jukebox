import {
  buildRouteState,
  normalizeRoute,
  parseRoute,
  serializeRoute,
  trackId,
} from '../app-core.mjs';

import {
  categoryList,
  currentTrack,
  recomputeVisible,
  sanctuaryList,
  tabList,
  yearList,
} from './app-state.js';

function recordingYear(track) {
  if (!track?.recordedAt) return '';
  const year = new Date(track.recordedAt).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : '';
}

export function trackMatchesMapFilters(state, track) {
  if (!track) return false;
  return (state.category === 'all' || track.category === state.category)
    && (state.sanctuary === 'all' || track.sanctuary === state.sanctuary)
    && (state.selectedYear === 'all' || recordingYear(track) === state.selectedYear);
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
    const routeTrackIndex = state.tracks.findIndex(track => trackId(track) === normalized.track);
    if (routeTrackIndex !== -1) {
      state.currentIndex = routeTrackIndex;
    }
  }

  state.isApplyingRoute = false;
}

export function syncUrl(state, method = 'replaceState', win = window) {
  if (state.isApplyingRoute) return;
  if (!win.history?.replaceState) return;

  const selected = currentTrack(state);
  const routeTrack = state.activeTab === 'map' && !trackMatchesMapFilters(state, selected)
    ? null
    : selected;
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
    // Restricted browser contexts can reject history updates; keep the app usable.
  }
}

export function applyCurrentLocationRoute(state, win = window) {
  applyRoute(state, parseRoute(win.location.search));
}

export function bindRouteEvents(state, renderAll, win = window) {
  win.addEventListener('popstate', () => {
    applyCurrentLocationRoute(state, win);
    renderAll();
  });
}
