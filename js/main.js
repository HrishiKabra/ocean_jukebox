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
import { renderLiveSources } from './live-view.js';
import { renderMap } from './map-view.js';
import { renderSpectrogram } from './spectrogram-view.js';

function tabNames(els) {
  const tabs = els.tabs ? els.tabs.map(tab => tab.dataset.tab).filter(Boolean) : [];
  return tabs.length ? tabs : ['archive', 'map', 'live', 'spectrogram'];
}

function setTab(state, els, actions, tabName, options = {}) {
  const allowed = tabNames(els);
  state.activeTab = allowed.includes(tabName) ? tabName : 'archive';

  if (els.tabs) {
    els.tabs.forEach(tab => {
      const selected = tab.dataset.tab === state.activeTab;
      tab.classList.toggle('on', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  if (els.archivePanel) els.archivePanel.hidden = state.activeTab !== 'archive';
  if (els.mapPanel) els.mapPanel.hidden = state.activeTab !== 'map';
  if (els.livePanel) els.livePanel.hidden = state.activeTab !== 'live';
  if (els.spectrogramPanel) els.spectrogramPanel.hidden = state.activeTab !== 'spectrogram';

  if (options.sync !== false) syncUrl(state, options.history || 'replaceState');
  actions.renderAll();
}

function init() {
  const els = cacheElements();
  const state = createAppState();
  applyCurrentLocationRoute(state);

  function renderAll() {
    syncControlsFromState(state, els);
    updateMeta(state, els);
    buildFilters(state, els, actions);
    renderTrackList(state, els, actions);
    renderTrackDetail(state, els, actions);
    highlightCurrent(state, els);
    syncCurrentTrackSource(state, els);
    if (state.activeTab === 'map') renderMap(state, els, actions);
    if (state.activeTab === 'live') renderLiveSources(state, els);
    if (state.activeTab === 'spectrogram') renderSpectrogram(state, els);
  }

  const actions = {
    renderAll,
    setTrack: (index, options = {}) => setTrack(state, els, actions, index, options),
    setTab: (tabName, options = {}) => setTab(state, els, actions, tabName, options),
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
    els.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => actions.setTab(tab.dataset.tab, { history: 'pushState' }));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const last = els.tabs.length - 1;
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : event.key === 'ArrowRight'
              ? (index + 1) % els.tabs.length
              : (index - 1 + els.tabs.length) % els.tabs.length;
        els.tabs[nextIndex].focus();
        actions.setTab(els.tabs[nextIndex].dataset.tab, { history: 'pushState' });
      });
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
