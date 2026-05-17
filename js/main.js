import { cacheElements } from './dom.js';
import { createAppState } from './app-state.js';
import { registerServiceWorker } from './service-worker.js';

function init() {
  const els = cacheElements();
  const state = createAppState();
  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${state.tracks.length} NOAA SanctSound recordings loaded.`;
  }
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
