import { expect, test } from '@playwright/test';

function countFromText(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

test.beforeEach(async ({ page }) => {
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
  await expect(page.locator('#map-summary')).toContainText(/recording|Map assets|metadata/i);

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
