import { cacheElements } from './dom.js';
import { createAppState, recomputeVisible } from './app-state.js';
import { applyCurrentLocationRoute, bindRouteEvents, syncUrl } from './routes.js';
import { registerServiceWorker } from './service-worker.js';
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
  }

  const actions = {
    renderAll,
    setTrack(index, options = {}) {
      if (!state.tracks[index]) return;
      state.currentIndex = index;
      renderAll();
      if (options.sync !== false) syncUrl(state, options.history);
    },
    setTab,
    playPause() {},
  };

  if (els.detailsButton) {
    els.detailsButton.addEventListener('click', () => {
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
  if (els.playButton) {
    els.playButton.addEventListener('click', () => actions.playPause());
  }

  bindRouteEvents(state, () => {
    renderAll();
  });
  renderAll();

  if (!state.tracks.length && els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
