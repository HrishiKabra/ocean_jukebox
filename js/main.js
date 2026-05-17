import { cacheElements } from './dom.js';
import { createAppState, currentTrack, recomputeVisible } from './app-state.js';
import { applyCurrentLocationRoute, bindRouteEvents, syncUrl } from './routes.js';
import { registerServiceWorker } from './service-worker.js';
import {
  bindPlayerEvents,
  navigate,
  playPause,
  setTrack,
  shuffleOrder,
  syncCurrentTrackSource,
} from './player.js';
import {
  buildFilters,
  closeTrackDetail,
  copySourceUrl,
  highlightCurrent,
  openTrackDetail,
  renderTrackDetail,
  renderTrackList,
  syncControlsFromState,
  updateMeta,
} from './archive-view.js';

function init() {
  const els = cacheElements();
  const state = createAppState();
  applyCurrentLocationRoute(state);

  function setTab(tabName, options = {}) {
    const tabs = els.tabs ? els.tabs.map(tab => tab.dataset.tab).filter(Boolean) : [];
    const allowed = tabs.length ? tabs : ['archive', 'map', 'live', 'spectrogram'];
    state.activeTab = allowed.includes(tabName) ? tabName : 'archive';
    syncControlsFromState(state, els);
    if (options.sync !== false) syncUrl(state, options.history);
  }

  function renderAll() {
    syncControlsFromState(state, els);
    updateMeta(state, els);
    buildFilters(state, els, actions);
    renderTrackList(state, els, actions);
    renderTrackDetail(state, els, actions);
    highlightCurrent(state, els);
    syncCurrentTrackSource(state, els);
  }

  const actions = {
    renderAll,
    setTrack: (index, options = {}) => setTrack(state, els, actions, index, options),
    setTab,
    playPause: () => playPause(state, els),
    navigate: delta => navigate(state, els, actions, delta),
    shuffleOrder: () => shuffleOrder(state, els, actions),
  };

  if (els.detailsButton) {
    els.detailsButton.addEventListener('click', () => {
      if (!currentTrack(state)) return;
      renderTrackDetail(state, els, actions);
      openTrackDetail(els);
    });
  }
  if (els.detailCloseButton) {
    els.detailCloseButton.addEventListener('click', () => closeTrackDetail(els));
  }
  if (els.copySourceButton) {
    els.copySourceButton.addEventListener('click', () => copySourceUrl(state, els));
  }
  if (els.query) {
    els.query.addEventListener('input', () => {
      state.query = els.query.value;
      recomputeVisible(state);
      syncUrl(state);
      actions.renderAll();
    });
  }
  if (els.sanctuarySelect) {
    els.sanctuarySelect.addEventListener('change', () => {
      state.sanctuary = els.sanctuarySelect.value;
      recomputeVisible(state);
      syncUrl(state, 'pushState');
      actions.renderAll();
    });
  }
  if (els.sortSelect) {
    els.sortSelect.addEventListener('change', () => {
      state.sort = els.sortSelect.value;
      recomputeVisible(state);
      syncUrl(state, 'pushState');
      actions.renderAll();
    });
  }
  if (els.tabs) {
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => actions.setTab(tab.dataset.tab, { history: 'pushState' }));
    });
  }
  bindPlayerEvents(state, els, actions);

  bindRouteEvents(state, () => {
    if (currentTrack(state)) {
      actions.setTrack(state.currentIndex, { sync: false });
    } else {
      renderAll();
    }
  });
  if (currentTrack(state)) {
    actions.setTrack(state.currentIndex, { sync: false });
  } else {
    renderAll();
  }

  if (!state.tracks.length && els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
