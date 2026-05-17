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
