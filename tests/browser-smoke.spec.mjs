import { expect, test } from '@playwright/test';

const LEAFLET_STUB = `
(() => {
  function chainableMap(element) {
    return {
      element,
      setView() { return this; },
      fitBounds() { return this; },
      invalidateSize() { return this; },
    };
  }

  window.L = {
    map(element) {
      element.classList.add('leaflet-container');
      return chainableMap(element);
    },
    tileLayer() {
      return {
        addTo(map) {
          const layer = document.createElement('div');
          layer.className = 'leaflet-layer';
          map.element.appendChild(layer);
          return this;
        },
      };
    },
    layerGroup() {
      return {
        map: null,
        addTo(map) {
          this.map = map;
          return this;
        },
        clearLayers() {
          this.map?.element.querySelectorAll('.leaflet-marker-icon').forEach(marker => marker.remove());
        },
        addLayer(marker) {
          marker.addTo(this.map);
        },
      };
    },
    divIcon(options) {
      return options;
    },
    marker(_coords, options = {}) {
      return {
        popupHtml: '',
        clickHandler: null,
        bindPopup(html) {
          this.popupHtml = html;
          return this;
        },
        on(eventName, handler) {
          if (eventName === 'click') this.clickHandler = handler;
          return this;
        },
        addTo(map) {
          const marker = document.createElement('button');
          marker.type = 'button';
          marker.className = \`leaflet-marker-icon \${options.icon?.className || ''}\`.trim();
          marker.innerHTML = options.icon?.html || '';
          marker.dataset.popupHtml = this.popupHtml;
          if (this.clickHandler) marker.addEventListener('click', this.clickHandler);
          map.element.appendChild(marker);
          return this;
        },
      };
    },
  };
})();
`;

function countFromText(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const url = route.request().url();
    const parsed = new URL(url);

    if (url === 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js') {
      await route.fulfill({
        contentType: 'application/javascript',
        body: LEAFLET_STUB,
      });
      return;
    }

    if (
      url === 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css'
      || url === 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ) {
      await route.fulfill({
        contentType: 'text/css',
        body: '',
      });
      return;
    }

    if (parsed.hostname.endsWith('.tile.openstreetmap.org')) {
      await route.abort();
      return;
    }

    if (parsed.origin !== 'http://127.0.0.1:4173') {
      await route.abort();
      return;
    }

    await route.continue();
  });

  await page.addInitScript({ content: LEAFLET_STUB });

  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function load() {
      this.dispatchEvent(new Event('loadedmetadata'));
    };
    HTMLMediaElement.prototype.play = function play() {
      this.dispatchEvent(new Event('waiting'));
      return Promise.reject(new Error('Playback disabled during browser smoke tests.'));
    };
  });

  await page.goto('/');
});

test('archive loads catalog recordings and renders indexed track rows', async ({ page }) => {
  await expect(page.locator('#s-label')).not.toHaveText('Loading catalog');

  const resultCount = page.locator('#result-count');
  await expect(resultCount).toContainText(/recording/i);
  expect(countFromText(await resultCount.textContent())).toBeGreaterThan(0);

  const rows = page.locator('[data-track-index]');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
});

test('weather category filter narrows visible recordings', async ({ page }) => {
  await expect(page.locator('[data-track-index]').first()).toBeVisible();
  const initialRows = await page.locator('[data-track-index]').count();

  await page.getByRole('button', { name: 'Weather' }).click();

  const resultCount = page.locator('#result-count');
  await expect(resultCount).toContainText(/recording/i);
  const filteredRows = await page.locator('[data-track-index]').count();

  expect(filteredRows).toBeGreaterThan(0);
  expect(filteredRows).toBeLessThanOrEqual(initialRows);
  expect(countFromText(await resultCount.textContent())).toBe(filteredRows);
});

test('play button reports a meaningful playback status', async ({ page }) => {
  await expect(page.locator('[data-track-index]').first()).toBeVisible();

  await page.locator('#btn-play').click();

  await expect(page.locator('#status')).toHaveText(
    /Loading audio|could not be played|could not be loaded|Paused|Playing/i,
  );
});

test('map live and spectrogram tabs render stable visible states', async ({ page }) => {
  await page.getByRole('tab', { name: /map/i }).click();
  await expect(page.locator('#map-panel')).toBeVisible();
  await expect(page.locator('#leaflet-map')).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText(/recording/i);
  const markers = page.locator('#leaflet-map .leaflet-marker-icon.ocean-marker .ocean-marker-dot');
  await expect(markers.first()).toBeVisible();
  expect(await markers.count()).toBeGreaterThan(0);

  await page.getByRole('tab', { name: /live/i }).click();
  await expect(page.locator('#live-panel')).toBeVisible();
  await expect(page.locator('.live-note')).toContainText(/separate/i);
  await expect(page.locator('#live-grid')).toContainText(/source/i);
  await expect(page.locator('#live-grid')).toContainText(/MBARI/i);

  await page.getByRole('tab', { name: /spectrogram/i }).click();
  await expect(page.locator('#spectrogram-panel')).toBeVisible();

  const spectrogramEmpty = page.locator('#spectrogram-empty');
  const spectrogramImg = page.locator('#spectrogram-img');
  await expect(async () => {
    const emptyVisible = await spectrogramEmpty.isVisible();
    const imageVisible = await spectrogramImg.isVisible();
    expect(emptyVisible || imageVisible).toBe(true);
  }).toPass();
});
