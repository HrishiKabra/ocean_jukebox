import { cacheElements } from './dom.js';
import { createAppState } from './app-state.js';
import { applyCurrentLocationRoute, bindRouteEvents } from './routes.js';
import { registerServiceWorker } from './service-worker.js';

function init() {
  const els = cacheElements();
  const state = createAppState();
  applyCurrentLocationRoute(state);
  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  bindRouteEvents(state, () => {
    if (els.catalogMeta) {
      els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
    }
  });
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
