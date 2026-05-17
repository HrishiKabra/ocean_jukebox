import {
  CATEGORY_LABELS,
  buildFilteredMapPins,
  buildMapPinSummary,
  formatCount,
} from '../app-core.mjs';

import { currentTrack, recomputeVisible, yearList } from './app-state.js';
import { syncUrl } from './routes.js';

export function markerHtml(pin) {
  return `<div class="ocean-marker-dot${pin.active ? ' active' : ''}">${pin.count}</div>`;
}

export function popupHtml(pin) {
  const displayName = pin.displayName || pin.name;
  const note = pin.note ? `<br>${pin.note}` : '';
  return `<strong>${displayName}</strong><br>${formatCount(pin.count)} for the current map filters.${note}`;
}

function formatDate(value) {
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

export function renderMap(state, els, actions) {
  if (!els.leafletMap || !els.mapSummary) return;

  if (!state.leaflet) {
    if (!window.L) {
      els.mapSummary.textContent = 'Map assets are unavailable. The recording catalog is still usable from the Archive tab.';
      return;
    }
    state.leaflet = L.map(els.leafletMap, { scrollWheelZoom: false }).setView([32, -118], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 9,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.leaflet);
    state.leafletLayer = L.layerGroup().addTo(state.leaflet);
  }

  if (!state.leafletLayer) {
    els.mapSummary.textContent = 'Map tiles are unavailable in this browser session.';
    return;
  }

  const track = currentTrack(state);
  const activeSanctuary = state.sanctuary !== 'all'
    ? state.sanctuary
    : track && track.sanctuary
      ? track.sanctuary
      : 'all';
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
    const icon = L.divIcon({
      className: 'ocean-marker',
      html: markerHtml(pin),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([pin.lat, pin.lng], { icon })
      .bindPopup(popupHtml(pin))
      .on('click', () => {
        state.sanctuary = pin.name;
        state.leaflet.setView([pin.lat, pin.lng], pin.zoom || 7);
        if (els.mapCategoryFilter) els.mapCategoryFilter.value = state.category;
        if (els.sanctuarySelect) els.sanctuarySelect.value = state.sanctuary;
        recomputeVisible(state);
        actions.renderAll();
        renderMap(state, els, actions);
        syncUrl(state, 'pushState');
      });
    state.leafletLayer.addLayer(marker);
  });

  const activePin = pins.find(pin => pin.active)
    || pins.find(pin => pin.count > 0)
    || pins[0];
  els.mapSummary.textContent = buildMapPinSummary(activePin);
  if (activePin && activePin.active) {
    state.leaflet.setView([activePin.lat, activePin.lng], activePin.zoom || 7);
  } else if (pins.length > 1) {
    state.leaflet.fitBounds(pins.map(pin => [pin.lat, pin.lng]), { padding: [28, 28], maxZoom: 4 });
  }
  window.setTimeout(() => state.leaflet.invalidateSize(), 0);
}
