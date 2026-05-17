import { cacheElements } from './dom.js';
import { createAppState, currentTrack, recomputeVisible } from './app-state.js';
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
  renderWaveform,
  syncControlsFromState,
  updateMeta,
} from './archive-view.js';
import {
  bindPlayerEvents,
  mediaUrl,
  navigate,
  playPause,
  setTrack,
  shuffleOrder,
} from './player.js';
import { renderMap } from './map-view.js';
import { renderLiveSources } from './live-view.js';
import { renderSpectrogram } from './spectrogram-view.js';

function init() {
  const els = cacheElements();
  const state = createAppState();
  applyCurrentLocationRoute(state);

  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }

  const actions = {
    renderAll,
    setTrack: (index, options) => setTrack(state, els, actions, index, options),
    setTab: (tabName, options) => setTab(state, els, actions, tabName, options),
    playPause: () => playPause(state, els),
    navigate: delta => navigate(state, els, actions, delta),
  };

  function renderAll() {
    syncControlsFromState(state, els);
    updateMeta(state, els);
    buildFilters(state, els, actions);
    renderTrackList(state, els, actions);
    renderTrackDetail(state, els, actions);
    highlightCurrent(state, els);
    if (state.activeTab === 'map') renderMap(state, els, actions);
    if (state.activeTab === 'live') renderLiveSources(state, els);
    if (state.activeTab === 'spectrogram') renderSpectrogram(state, els);
  }

  function setTab(tabName, options = {}) {
    state.activeTab = tabName;
    for (const tab of els.tabs) {
      const selected = tab.dataset.tab === tabName;
      tab.classList.toggle('on', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    }
    els.archivePanel.hidden = tabName !== 'archive';
    els.mapPanel.hidden = tabName !== 'map';
    els.livePanel.hidden = tabName !== 'live';
    els.spectrogramPanel.hidden = tabName !== 'spectrogram';
    syncUrl(state, options.history || 'replaceState');
    actions.renderAll();
  }

  // Populate sort select
  const SORT_LABELS = {
    curated: 'Catalog order',
    newest: 'Newest',
    oldest: 'Oldest',
    sanctuary: 'Sanctuary',
  };
  if (els.sortSelect) {
    els.sortSelect.innerHTML = '';
    Object.entries(SORT_LABELS).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.sortSelect.appendChild(option);
    });
  }

  // Bind filter events
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

  // Bind map filter events
  if (els.mapCategoryFilter) {
    els.mapCategoryFilter.addEventListener('change', () => {
      state.category = els.mapCategoryFilter.value;
      recomputeVisible(state);
      renderMap(state, els, actions);
      actions.renderAll();
      syncUrl(state, 'pushState');
    });
  }
  if (els.mapYearFilter) {
    els.mapYearFilter.addEventListener('change', () => {
      state.selectedYear = els.mapYearFilter.value;
      syncControlsFromState(state, els);
      renderMap(state, els, actions);
      highlightCurrent(state, els);
      syncUrl(state, 'pushState');
    });
  }

  // Bind detail events
  if (els.detailsButton) {
    els.detailsButton.addEventListener('click', () => openTrackDetail(els));
  }
  if (els.detailCloseButton) {
    els.detailCloseButton.addEventListener('click', () => closeTrackDetail(els));
  }
  if (els.copySourceButton) {
    els.copySourceButton.addEventListener('click', () => copySourceUrl(state, els));
  }

  // Bind tab events
  for (const tab of els.tabs) {
    tab.addEventListener('click', () => actions.setTab(tab.dataset.tab, { history: 'pushState' }));
  }
  for (const [index, tab] of els.tabs.entries()) {
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const last = els.tabs.length - 1;
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight'
            ? Math.min(last, index + 1)
            : Math.max(0, index - 1);
      els.tabs[nextIndex].focus();
      actions.setTab(els.tabs[nextIndex].dataset.tab, { history: 'pushState' });
    });
  }

  // Bind player events
  bindPlayerEvents(state, els, actions);

  // Initial render
  renderAll();
  if (state.tracks.length) {
    setTrack(state, els, actions, state.currentIndex, { sync: false });
    syncUrl(state);
  }

  bindRouteEvents(state, renderAll);
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
