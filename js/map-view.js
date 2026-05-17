import {
  CATEGORY_LABELS,
  buildFilteredMapPins,
  buildMapPinSummary,
  formatCount,
} from '../app-core.mjs';

import { currentTrack, recomputeVisible, yearList } from './app-state.js';
import { syncUrl } from './routes.js';

const MAP_UNAVAILABLE = 'Map assets are unavailable. The recording catalog is still usable from the Archive tab.';

function populateOptions(select, options, labelFor) {
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '';
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labelFor(value);
    select.appendChild(option);
  });
  if (options.includes(selected)) select.value = selected;
}

function renderMapFilters(state, els, actions) {
  populateOptions(
    els.mapCategoryFilter,
    ['all', ...new Set(state.tracks.map(track => track.category).filter(Boolean).sort())],
    category => (category === 'all' ? 'All categories' : CATEGORY_LABELS[category] || category),
  );
  populateOptions(
    els.mapYearFilter,
    yearList(state),
    year => (year === 'all' ? 'All years' : year),
  );

  if (els.mapCategoryFilter) {
    els.mapCategoryFilter.value = state.category;
    if (!els.mapCategoryFilter.dataset.mapViewBound) {
      els.mapCategoryFilter.dataset.mapViewBound = 'true';
      els.mapCategoryFilter.addEventListener('change', () => {
        state.category = els.mapCategoryFilter.value;
        recomputeVisible(state);
        syncUrl(state, 'pushState');
        actions.renderAll();
      });
    }
  }

  if (els.mapYearFilter) {
    els.mapYearFilter.value = state.selectedYear;
    if (!els.mapYearFilter.dataset.mapViewBound) {
      els.mapYearFilter.dataset.mapViewBound = 'true';
      els.mapYearFilter.addEventListener('change', () => {
        state.selectedYear = els.mapYearFilter.value;
        recomputeVisible(state);
        syncUrl(state, 'pushState');
        actions.renderAll();
      });
    }
  }
}

export function initLeafletMap(state, els) {
  if (state.leaflet || !els.leafletMap) return;
  if (!window.L) {
    if (els.mapSummary) els.mapSummary.textContent = MAP_UNAVAILABLE;
    return;
  }

  state.leaflet = window.L.map(els.leafletMap, { scrollWheelZoom: false }).setView([32, -118], 3);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 9,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(state.leaflet);
  state.leafletLayer = window.L.layerGroup().addTo(state.leaflet);
}

export function markerHtml(pin) {
  return `<div class="ocean-marker-dot${pin.active ? ' active' : ''}">${pin.count}</div>`;
}

export function popupHtml(pin) {
  const displayName = pin.displayName || pin.name;
  const note = pin.note ? `<br>${pin.note}` : '';
  return `<strong>${displayName}</strong><br>${formatCount(pin.count)} for the current map filters.${note}`;
}

export function renderMap(state, els, actions) {
  if (!els.leafletMap || !els.mapSummary) return;
  renderMapFilters(state, els, actions);
  initLeafletMap(state, els);

  if (!state.leaflet || !state.leafletLayer || !window.L) {
    els.mapSummary.textContent = MAP_UNAVAILABLE;
    return;
  }

  const activeTrack = currentTrack(state);
  const activeSanctuary = state.sanctuary !== 'all'
    ? state.sanctuary
    : activeTrack?.sanctuary || 'all';
  const pins = buildFilteredMapPins(state.sanctuaries, state.tracks, {
    category: state.category,
    year: state.selectedYear,
    activeSanctuary,
  });

  state.leafletLayer.clearLayers();
  if (!pins.length) {
    els.mapSummary.textContent = 'No sanctuary map metadata available.';
    return;
  }

  pins.forEach(pin => {
    const icon = window.L.divIcon({
      className: 'ocean-marker',
      html: markerHtml(pin),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = window.L.marker([pin.lat, pin.lng], { icon })
      .bindPopup(popupHtml(pin))
      .on('click', () => {
        state.sanctuary = pin.name;
        recomputeVisible(state);
        syncUrl(state, 'pushState');
        if (state.leaflet) state.leaflet.setView([pin.lat, pin.lng], pin.zoom || 7);
        actions.renderAll();
      });
    state.leafletLayer.addLayer(marker);
  });

  const activePin = pins.find(pin => pin.active)
    || pins.find(pin => pin.count > 0)
    || pins[0];
  els.mapSummary.textContent = buildMapPinSummary(activePin);

  if (activePin?.active) {
    state.leaflet.setView([activePin.lat, activePin.lng], activePin.zoom || 7);
  } else if (pins.length > 1) {
    state.leaflet.fitBounds(pins.map(pin => [pin.lat, pin.lng]), { padding: [28, 28], maxZoom: 4 });
  }
  window.setTimeout(() => state.leaflet.invalidateSize(), 0);
}
